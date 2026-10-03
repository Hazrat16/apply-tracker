import type { MailMessage } from './mail.service.js';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

function layout(title: string, body: string, action: { label: string; url: string }): string {
  // Every message ends with a call to action; footers explain how to opt out.
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:system-ui,sans-serif;color:#171717">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
    ${body}
    <p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#171717;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p>
    <p style="font-size:12px;color:#737373">If the button doesn't work, paste this link into your browser:<br>${escapeHtml(action.url)}</p>
  </div>
</body></html>`;
}

const greeting = (name: string | null) => (name ? `Hi ${name},` : 'Hi,');

export function verifyEmailMessage(to: string, name: string | null, url: string): MailMessage {
  return {
    to,
    subject: 'Verify your email for ApplyTracker',
    text: `${greeting(name)}\n\nConfirm your email address by opening this link (valid for 24 hours):\n${url}\n`,
    html: layout(
      'Verify your email',
      `<p>${escapeHtml(greeting(name))}</p><p>Confirm your email address to finish setting up ApplyTracker. This link is valid for 24 hours.</p>`,
      { label: 'Verify email', url },
    ),
  };
}

export function resetPasswordMessage(to: string, name: string | null, url: string): MailMessage {
  return {
    to,
    subject: 'Reset your ApplyTracker password',
    text: `${greeting(name)}\n\nReset your password by opening this link (valid for 1 hour):\n${url}\n\nIf you didn't request this, you can ignore this email.\n`,
    html: layout(
      'Reset your password',
      `<p>${escapeHtml(greeting(name))}</p><p>We received a request to reset your password. This link is valid for 1 hour.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
      { label: 'Reset password', url },
    ),
  };
}

const footer = (settingsUrl: string) =>
  `<p style="font-size:12px;color:#737373;margin-top:24px">You can turn these emails off in <a href="${escapeHtml(settingsUrl)}" style="color:#737373">notification settings</a>.</p>`;

export function reminderDueMessage(
  to: string,
  name: string | null,
  reminder: { title: string; note: string | null; context: string | null },
  urls: { open: string; settings: string },
): MailMessage {
  const lines = [reminder.context, reminder.note].filter(Boolean) as string[];
  return {
    to,
    subject: `Reminder: ${reminder.title}`,
    text: `${greeting(name)}\n\nReminder: ${reminder.title}\n${lines.join('\n')}\n\nOpen ApplyTracker: ${urls.open}\n`,
    html: layout(
      reminder.title,
      `<p>${escapeHtml(greeting(name))}</p>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}${footer(urls.settings)}`,
      { label: 'Open in ApplyTracker', url: urls.open },
    ),
  };
}

export function interviewSoonMessage(
  to: string,
  name: string | null,
  interview: {
    label: string;
    when: string;
    location: string | null;
    company: string;
    role: string;
  },
  urls: { open: string; settings: string },
): MailMessage {
  const where = interview.location ? `Where: ${interview.location}` : null;
  return {
    to,
    subject: `${interview.label} with ${interview.company} — ${interview.when}`,
    text: `${greeting(name)}\n\nYour ${interview.label.toLowerCase()} for ${interview.role} at ${interview.company} is ${interview.when}.\n${where ?? ''}\n\nGood luck!\n${urls.open}\n`,
    html: layout(
      `${interview.label} — ${interview.when}`,
      `<p>${escapeHtml(greeting(name))}</p><p>Your ${escapeHtml(interview.label.toLowerCase())} for <strong>${escapeHtml(interview.role)}</strong> at <strong>${escapeHtml(interview.company)}</strong> is ${escapeHtml(interview.when)}.</p>${where ? `<p>${escapeHtml(where)}</p>` : ''}<p>Good luck!</p>${footer(urls.settings)}`,
      { label: 'Review your notes', url: urls.open },
    ),
  };
}

export interface WeeklySummary {
  added: number;
  interviews: number;
  offers: number;
  rejections: number;
  upcoming: { when: string; label: string }[];
  overdueReminders: number;
  followUpsDue: number;
}

export function weeklySummaryMessage(
  to: string,
  name: string | null,
  summary: WeeklySummary,
  urls: { open: string; settings: string },
): MailMessage {
  const stats = [
    `${summary.added} new application${summary.added === 1 ? '' : 's'}`,
    `${summary.interviews} moved to interview`,
    `${summary.offers} offer${summary.offers === 1 ? '' : 's'}`,
    `${summary.rejections} rejection${summary.rejections === 1 ? '' : 's'}`,
  ];
  const todo = [
    summary.overdueReminders &&
      `${summary.overdueReminders} overdue reminder${summary.overdueReminders === 1 ? '' : 's'}`,
    summary.followUpsDue &&
      `${summary.followUpsDue} application${summary.followUpsDue === 1 ? '' : 's'} waiting for a follow-up`,
  ].filter(Boolean) as string[];
  const upcoming = summary.upcoming.map((item) => `${item.when} — ${item.label}`);

  const list = (items: string[]) =>
    `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return {
    to,
    subject: 'Your job search this week',
    text: [
      greeting(name),
      '',
      'Last 7 days:',
      ...stats.map((s) => `- ${s}`),
      ...(upcoming.length ? ['', 'Coming up:', ...upcoming.map((s) => `- ${s}`)] : []),
      ...(todo.length ? ['', 'To do:', ...todo.map((s) => `- ${s}`)] : []),
      '',
      urls.open,
    ].join('\n'),
    html: layout(
      'Your job search this week',
      `<p>${escapeHtml(greeting(name))}</p><p><strong>Last 7 days</strong></p>${list(stats)}${upcoming.length ? `<p><strong>Coming up</strong></p>${list(upcoming)}` : ''}${todo.length ? `<p><strong>To do</strong></p>${list(todo)}` : ''}${footer(urls.settings)}`,
      { label: 'Open your board', url: urls.open },
    ),
  };
}
