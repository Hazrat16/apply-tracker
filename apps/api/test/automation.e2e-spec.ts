import { getQueueToken } from '@nestjs/bullmq';
import type { Notification, NotificationList, Reminder } from '@apply-tracker/shared';
import type { Queue } from 'bullmq';
import type TestAgent from 'supertest/lib/agent.js';
import { AutomationService } from '../src/automation/automation.service.js';
import { EMAIL_QUEUE, NOTIFICATIONS_QUEUE } from '../src/queue/queue.constants.js';
import { reminderJobId } from '../src/reminders/reminders.service.js';
import { createTestApp, signedInAgent, type TestContext } from './helpers.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('Reminders, notifications & calendar (e2e)', () => {
  let ctx: TestContext;
  let jane: TestAgent;
  let automation: AutomationService;
  let notificationsQueue: Queue;
  let emailQueue: Queue;

  beforeAll(async () => {
    ctx = await createTestApp();
    automation = ctx.app.get(AutomationService);
    notificationsQueue = ctx.app.get(getQueueToken(NOTIFICATIONS_QUEUE));
    emailQueue = ctx.app.get(getQueueToken(EMAIL_QUEUE));
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.resetDb();
    await notificationsQueue.obliterate({ force: true });
    await emailQueue.obliterate({ force: true });
    jane = await signedInAgent(ctx);
  });

  const createApp = async (agent: TestAgent, body: object = {}) =>
    (
      await agent
        .post('/api/v1/applications')
        .send({ companyName: 'Acme', roleTitle: 'Engineer', ...body })
        .expect(201)
    ).body as { id: string };

  const createReminder = async (agent: TestAgent, body: object): Promise<Reminder> =>
    (await agent.post('/api/v1/reminders').send(body).expect(201)).body;

  const notifications = async (agent: TestAgent): Promise<NotificationList> =>
    (await agent.get('/api/v1/notifications').expect(200)).body;

  const queuedEmails = async () =>
    (await emailQueue.getJobs(['waiting', 'delayed'])).map(
      (job) => job.data as { to: string; subject: string },
    );

  describe('reminders', () => {
    it('creates a reminder and schedules a delayed job for its due time', async () => {
      const app = await createApp(jane);
      const dueAt = new Date(Date.now() + 2 * DAY);
      const reminder = await createReminder(jane, {
        applicationId: app.id,
        title: 'Follow up with Acme',
        dueAt: dueAt.toISOString(),
      });

      expect(reminder).toMatchObject({
        title: 'Follow up with Acme',
        completedAt: null,
        application: { id: app.id, roleTitle: 'Engineer', companyName: 'Acme' },
      });
      const job = await notificationsQueue.getJob(reminderJobId(reminder.id, dueAt));
      expect(job?.name).toBe('reminder-due');
      expect(job?.opts.delay).toBeGreaterThan(DAY);

      const open = await jane.get(`/api/v1/reminders?applicationId=${app.id}`).expect(200);
      expect(open.body.map((r: Reminder) => r.id)).toEqual([reminder.id]);
    });

    it('completes, reopens and deletes reminders, and keeps them private', async () => {
      const reminder = await createReminder(jane, {
        title: 'Update CV',
        dueAt: new Date(Date.now() + DAY).toISOString(),
      });
      const mallory = await signedInAgent(ctx, 'mallory@example.com');
      await mallory.patch(`/api/v1/reminders/${reminder.id}`).send({ completed: true }).expect(404);
      expect((await mallory.get('/api/v1/reminders').expect(200)).body).toEqual([]);

      await jane.patch(`/api/v1/reminders/${reminder.id}`).send({ completed: true }).expect(200);
      expect((await jane.get('/api/v1/reminders').expect(200)).body).toEqual([]);
      expect((await jane.get('/api/v1/reminders?status=done').expect(200)).body).toHaveLength(1);

      await jane.delete(`/api/v1/reminders/${reminder.id}`).expect(204);
      await jane.delete(`/api/v1/reminders/${reminder.id}`).expect(404);
    });

    it("rejects reminders for another user's application", async () => {
      const mallory = await signedInAgent(ctx, 'mallory@example.com');
      const app = await createApp(mallory);
      await jane
        .post('/api/v1/reminders')
        .send({ applicationId: app.id, title: 'x', dueAt: new Date().toISOString() })
        .expect(404);
    });
  });

  describe('when a reminder is due', () => {
    it('notifies in-app and by email exactly once', async () => {
      const app = await createApp(jane);
      const reminder = await createReminder(jane, {
        applicationId: app.id,
        title: 'Send thank-you note',
        note: 'Mention the system design discussion',
        dueAt: new Date(Date.now() - 1000).toISOString(),
      });
      const data = { reminderId: reminder.id, dueAt: reminder.dueAt };

      expect(await automation.reminderDue(data)).toBe(true);
      expect(await automation.reminderDue(data)).toBe(false); // retried job: no duplicate

      const list = await notifications(jane);
      expect(list.unreadCount).toBe(1);
      expect(list.items[0]).toMatchObject({
        type: 'REMINDER_DUE',
        title: 'Send thank-you note',
        body: 'Mention the system design discussion',
        link: `/applications/${app.id}`,
      });
      expect(await queuedEmails()).toEqual([
        expect.objectContaining({
          to: 'jane@example.com',
          subject: 'Reminder: Send thank-you note',
        }),
      ]);
    });

    it('skips stale jobs for rescheduled reminders and respects email preferences', async () => {
      const reminder = await createReminder(jane, {
        title: 'Call recruiter',
        dueAt: new Date(Date.now() - 1000).toISOString(),
      });
      const later = new Date(Date.now() + DAY).toISOString();
      await jane.patch(`/api/v1/reminders/${reminder.id}`).send({ dueAt: later }).expect(200);

      // The job for the old due time fires: nothing happens.
      expect(await automation.reminderDue({ reminderId: reminder.id, dueAt: reminder.dueAt })).toBe(
        false,
      );

      await jane.patch('/api/v1/users/me/preferences').send({ emailReminders: false }).expect(200);
      expect(await automation.reminderDue({ reminderId: reminder.id, dueAt: later })).toBe(true);
      expect(await queuedEmails()).toEqual([]);
    });

    it('re-queues due reminders whose job was lost (sweep)', async () => {
      const reminder = await createReminder(jane, {
        title: 'Lost one',
        dueAt: new Date(Date.now() - 1000).toISOString(),
      });
      await notificationsQueue.obliterate({ force: true }); // simulate losing Redis data

      expect(await automation.sweepDueReminders()).toBe(1);
      const job = await notificationsQueue.getJob(
        reminderJobId(reminder.id, new Date(reminder.dueAt)),
      );
      expect(job?.data).toEqual({ reminderId: reminder.id, dueAt: reminder.dueAt });
    });
  });

  describe('follow-up suggestions', () => {
    const ageApplication = (id: string, days: number) =>
      ctx.prisma
        .$executeRaw`UPDATE applications SET updated_at = now() - make_interval(days => ${days}) WHERE id = ${id}::uuid`;

    it('suggests a follow-up for quiet active applications, once', async () => {
      const quiet = await createApp(jane, { status: 'APPLIED' });
      const fresh = await createApp(jane, { companyName: 'Globex', status: 'APPLIED' });
      const wishlist = await createApp(jane, { companyName: 'Initech', status: 'WISHLIST' });
      await ageApplication(quiet.id, 10);
      await ageApplication(wishlist.id, 30); // not applied yet: no follow-up

      expect(await automation.suggestFollowUps()).toBe(1);
      expect(await automation.suggestFollowUps()).toBe(0);

      const [notification] = (await notifications(jane)).items as Notification[];
      expect(notification).toMatchObject({
        type: 'FOLLOW_UP_SUGGESTED',
        title: 'Follow up with Acme?',
        link: `/applications/${quiet.id}`,
      });
      expect(notification?.body).toContain('10 days');
      expect(fresh.id).toBeDefined();
    });

    it("respects the user's threshold and existing reminders", async () => {
      const app = await createApp(jane, { status: 'INTERVIEW' });
      await ageApplication(app.id, 10);

      await jane.patch('/api/v1/users/me/preferences').send({ followUpAfterDays: 14 }).expect(200);
      expect(await automation.suggestFollowUps()).toBe(0);

      await jane.patch('/api/v1/users/me/preferences').send({ followUpAfterDays: 7 }).expect(200);
      await createReminder(jane, {
        applicationId: app.id,
        title: 'Already planned',
        dueAt: new Date(Date.now() + DAY).toISOString(),
      });
      await ageApplication(app.id, 10); // adding a reminder doesn't change the application
      expect(await automation.suggestFollowUps()).toBe(0);
    });
  });

  it('gives a heads-up for interviews in the next 24 hours, once', async () => {
    const app = await createApp(jane, { status: 'INTERVIEW' });
    const soon = new Date(Date.now() + 3 * HOUR).toISOString();
    const nextWeek = new Date(Date.now() + 7 * DAY).toISOString();
    await jane
      .post(`/api/v1/applications/${app.id}/interviews`)
      .send({ type: 'TECHNICAL', scheduledAt: soon, location: 'Video call' })
      .expect(201);
    await jane
      .post(`/api/v1/applications/${app.id}/interviews`)
      .send({ type: 'FINAL', scheduledAt: nextWeek })
      .expect(201);

    expect(await automation.notifyUpcomingInterviews()).toBe(1);
    expect(await automation.notifyUpcomingInterviews()).toBe(0);

    expect((await notifications(jane)).items[0]).toMatchObject({
      type: 'INTERVIEW_UPCOMING',
      title: 'Technical interview with Acme',
    });
    expect((await queuedEmails())[0]?.subject).toMatch(/^Technical interview with Acme — /);
  });

  describe('weekly summary', () => {
    // Monday 5 Oct 2026 06:30 UTC = 08:30 in Berlin.
    const mondayMorningBerlin = new Date('2026-10-05T06:30:00Z');

    beforeEach(async () => {
      await jane
        .patch('/api/v1/users/me/preferences')
        .send({ timeZone: 'Europe/Berlin' })
        .expect(200);
    });

    it("is sent once, on Monday morning in the user's time zone", async () => {
      await createApp(jane, { status: 'APPLIED' });

      expect(await automation.sendWeeklySummaries(new Date('2026-10-05T08:30:00Z'))).toBe(0); // 10:30 Berlin
      expect(await automation.sendWeeklySummaries(mondayMorningBerlin)).toBe(1);
      expect(await automation.sendWeeklySummaries(new Date('2026-10-05T06:55:00Z'))).toBe(0); // same week

      const emails = await queuedEmails();
      expect(emails).toEqual([
        expect.objectContaining({ to: 'jane@example.com', subject: 'Your job search this week' }),
      ]);
    });

    it('is skipped when there is nothing to report or the user opted out', async () => {
      expect(await automation.sendWeeklySummaries(mondayMorningBerlin)).toBe(0);
      await createApp(jane);
      await jane.patch('/api/v1/users/me/preferences').send({ weeklySummary: false }).expect(200);
      expect(await automation.sendWeeklySummaries(mondayMorningBerlin)).toBe(0);
    });
  });

  describe('notifications API', () => {
    it('marks notifications read, one or all, for the owner only', async () => {
      const app = await createApp(jane, { status: 'APPLIED' });
      await ctx.prisma
        .$executeRaw`UPDATE applications SET updated_at = now() - interval '20 days' WHERE id = ${app.id}::uuid`;
      await automation.suggestFollowUps();
      const reminder = await createReminder(jane, {
        title: 'Due',
        dueAt: new Date(Date.now() - 1000).toISOString(),
      });
      await automation.reminderDue({ reminderId: reminder.id, dueAt: reminder.dueAt });

      const list = await notifications(jane);
      expect(list.unreadCount).toBe(2);

      const mallory = await signedInAgent(ctx, 'mallory@example.com');
      await mallory.post(`/api/v1/notifications/${list.items[0]!.id}/read`).expect(404);

      await jane.post(`/api/v1/notifications/${list.items[0]!.id}/read`).expect(204);
      expect((await notifications(jane)).unreadCount).toBe(1);
      await jane.post('/api/v1/notifications/read-all').expect(204);
      expect((await notifications(jane)).unreadCount).toBe(0);
      expect((await jane.get('/api/v1/notifications?unread=true').expect(200)).body.items).toEqual(
        [],
      );
    });
  });

  describe('preferences', () => {
    it('uses the time zone sent at registration', async () => {
      const agent = ctx.agent();
      await agent
        .post('/api/v1/auth/register')
        .send({
          name: 'Rafi',
          email: 'rafi@example.com',
          password: 'correct-horse-1',
          timeZone: 'Asia/Dhaka',
        })
        .expect(201);
      expect((await agent.get('/api/v1/users/me/preferences').expect(200)).body.timeZone).toBe(
        'Asia/Dhaka',
      );
    });

    it('reads defaults and validates updates', async () => {
      expect((await jane.get('/api/v1/users/me/preferences').expect(200)).body).toEqual({
        emailReminders: true,
        weeklySummary: true,
        followUpAfterDays: 7,
        timeZone: 'UTC',
      });
      const res = await jane
        .patch('/api/v1/users/me/preferences')
        .send({ timeZone: 'Mars/Olympus', followUpAfterDays: 0 })
        .expect(400);
      expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual([
        'followUpAfterDays',
        'timeZone',
      ]);
    });
  });

  describe('calendar', () => {
    it('lists interviews and reminders in a range', async () => {
      const app = await createApp(jane, { status: 'INTERVIEW' });
      const at = new Date(Date.now() + 2 * DAY);
      await jane
        .post(`/api/v1/applications/${app.id}/interviews`)
        .send({ type: 'ONSITE', scheduledAt: at.toISOString(), durationMinutes: 90 })
        .expect(201);
      await createReminder(jane, {
        title: 'Prepare questions',
        dueAt: new Date(at.getTime() - DAY).toISOString(),
      });
      await createReminder(jane, {
        title: 'Far future',
        dueAt: new Date(Date.now() + 60 * DAY).toISOString(),
      });

      const from = new Date().toISOString();
      const to = new Date(Date.now() + 7 * DAY).toISOString();
      const res = await jane
        .get(
          `/api/v1/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        )
        .expect(200);
      expect(res.body.map((e: { kind: string; title: string }) => `${e.kind}:${e.title}`)).toEqual([
        'reminder:Prepare questions',
        'interview:On-site interview — Acme',
      ]);
      expect(new Date(res.body[1].end).getTime() - new Date(res.body[1].start).getTime()).toBe(
        90 * 60_000,
      );

      await jane
        .get(
          `/api/v1/calendar/events?from=${encodeURIComponent(to)}&to=${encodeURIComponent(from)}`,
        )
        .expect(400);
    });

    it('exports .ics and serves a private, revocable subscription feed', async () => {
      const app = await createApp(jane, { status: 'INTERVIEW' });
      await jane
        .post(`/api/v1/applications/${app.id}/interviews`)
        .send({ type: 'TECHNICAL', scheduledAt: new Date(Date.now() + DAY).toISOString() })
        .expect(201);

      const download = await jane.get('/api/v1/calendar/applytracker.ics').expect(200);
      expect(download.headers['content-type']).toMatch(/text\/calendar/);
      expect(download.text).toContain('SUMMARY:Technical interview — Acme');

      expect((await jane.get('/api/v1/calendar/feed').expect(200)).body).toEqual({ url: null });
      const { url } = (await jane.post('/api/v1/calendar/feed').expect(200)).body as {
        url: string;
      };
      expect(url).toMatch(/^http:\/\/localhost:3000\/api\/v1\/calendar\/feed\/[\w-]{32}\.ics$/);

      const path = new URL(url).pathname;
      const feed = await ctx.agent().get(path).expect(200); // no cookies: calendar apps
      expect(feed.text).toContain('BEGIN:VEVENT');

      const rotated = (await jane.post('/api/v1/calendar/feed').expect(200)).body.url as string;
      expect(rotated).not.toBe(url);
      await ctx.agent().get(path).expect(404);

      await jane.delete('/api/v1/calendar/feed').expect(204);
      await ctx.agent().get(new URL(rotated).pathname).expect(404);
    });
  });

  it('reports Redis in the health check', async () => {
    const res = await ctx.agent().get('/api/health').expect(200);
    expect(res.body.details.redis).toEqual({ status: 'up' });
  });
});
