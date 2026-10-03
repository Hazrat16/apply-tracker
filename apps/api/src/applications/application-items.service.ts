import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Contact,
  ContactData,
  Interview,
  InterviewData,
  Note,
  NoteInput,
} from '@apply-tracker/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { toContact, toInterview, toNote } from './application.mapper.js';
import { ApplicationsService } from './applications.service.js';

/**
 * Notes, contacts and interviews belong to an application. Every operation first checks
 * that the application belongs to the user, then scopes the child row by application id.
 */
@Injectable()
export class ApplicationItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
  ) {}

  // ── Notes ──
  async addNote(userId: string, applicationId: string, input: NoteInput): Promise<Note> {
    await this.applications.assertOwned(userId, applicationId);
    const note = await this.prisma.note.create({ data: { applicationId, body: input.body } });
    await this.touch(applicationId);
    return toNote(note);
  }

  async updateNote(userId: string, applicationId: string, noteId: string, input: NoteInput) {
    await this.applications.assertOwned(userId, applicationId);
    await this.expectOne(
      this.prisma.note.updateMany({ where: { id: noteId, applicationId }, data: input }),
      'Note',
    );
    return toNote(await this.prisma.note.findUniqueOrThrow({ where: { id: noteId } }));
  }

  async deleteNote(userId: string, applicationId: string, noteId: string): Promise<void> {
    await this.applications.assertOwned(userId, applicationId);
    await this.expectOne(
      this.prisma.note.deleteMany({ where: { id: noteId, applicationId } }),
      'Note',
    );
  }

  // ── Contacts ──
  async addContact(userId: string, applicationId: string, input: ContactData): Promise<Contact> {
    await this.applications.assertOwned(userId, applicationId);
    return toContact(await this.prisma.contact.create({ data: { applicationId, ...input } }));
  }

  async updateContact(
    userId: string,
    applicationId: string,
    contactId: string,
    input: ContactData,
  ): Promise<Contact> {
    await this.applications.assertOwned(userId, applicationId);
    await this.expectOne(
      this.prisma.contact.updateMany({ where: { id: contactId, applicationId }, data: input }),
      'Contact',
    );
    return toContact(await this.prisma.contact.findUniqueOrThrow({ where: { id: contactId } }));
  }

  async deleteContact(userId: string, applicationId: string, contactId: string): Promise<void> {
    await this.applications.assertOwned(userId, applicationId);
    await this.expectOne(
      this.prisma.contact.deleteMany({ where: { id: contactId, applicationId } }),
      'Contact',
    );
  }

  // ── Interviews ──
  async addInterview(
    userId: string,
    applicationId: string,
    input: InterviewData,
  ): Promise<Interview> {
    await this.applications.assertOwned(userId, applicationId);
    const interview = await this.prisma.interview.create({
      data: { applicationId, ...input, scheduledAt: new Date(input.scheduledAt) },
    });
    await this.touch(applicationId);
    return toInterview(interview);
  }

  async updateInterview(
    userId: string,
    applicationId: string,
    interviewId: string,
    input: InterviewData,
  ): Promise<Interview> {
    await this.applications.assertOwned(userId, applicationId);
    await this.expectOne(
      this.prisma.interview.updateMany({
        where: { id: interviewId, applicationId },
        data: { ...input, scheduledAt: new Date(input.scheduledAt) },
      }),
      'Interview',
    );
    await this.touch(applicationId);
    return toInterview(
      await this.prisma.interview.findUniqueOrThrow({ where: { id: interviewId } }),
    );
  }

  async deleteInterview(userId: string, applicationId: string, interviewId: string) {
    await this.applications.assertOwned(userId, applicationId);
    await this.expectOne(
      this.prisma.interview.deleteMany({ where: { id: interviewId, applicationId } }),
      'Interview',
    );
  }

  /** Activity on a child counts as activity on the application (for "recently updated"). */
  private async touch(applicationId: string) {
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { updatedAt: new Date() },
    });
  }

  private async expectOne(operation: Promise<{ count: number }>, entity: string) {
    if ((await operation).count === 0) throw new NotFoundException(`${entity} not found`);
  }
}
