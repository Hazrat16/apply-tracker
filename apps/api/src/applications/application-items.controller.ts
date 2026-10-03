import { Controller, Delete, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type Contact,
  type ContactData,
  contactInputSchema,
  type Interview,
  type InterviewData,
  interviewInputSchema,
  type Note,
  type NoteInput,
  noteInputSchema,
} from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UuidParam } from '../common/params/uuid-param.decorator.js';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import { ApplicationItemsService } from './application-items.service.js';

@ApiTags('applications')
@ApiCookieAuth()
@Controller('applications/:applicationId')
export class ApplicationItemsController {
  constructor(private readonly items: ApplicationItemsService) {}

  @Post('notes')
  @ApiOperation({ summary: 'Add a note' })
  @ApiZodBody(noteInputSchema)
  addNote(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @ZodBody(noteInputSchema) body: NoteInput,
  ): Promise<Note> {
    return this.items.addNote(user.userId, applicationId, body);
  }

  @Patch('notes/:noteId')
  @ApiOperation({ summary: 'Edit a note' })
  @ApiZodBody(noteInputSchema)
  updateNote(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @UuidParam('noteId') noteId: string,
    @ZodBody(noteInputSchema) body: NoteInput,
  ): Promise<Note> {
    return this.items.updateNote(user.userId, applicationId, noteId, body);
  }

  @Delete('notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note' })
  @ApiNoContentResponse()
  deleteNote(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @UuidParam('noteId') noteId: string,
  ): Promise<void> {
    return this.items.deleteNote(user.userId, applicationId, noteId);
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Add a contact (recruiter, hiring manager…)' })
  @ApiZodBody(contactInputSchema)
  addContact(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @ZodBody(contactInputSchema) body: ContactData,
  ): Promise<Contact> {
    return this.items.addContact(user.userId, applicationId, body);
  }

  @Put('contacts/:contactId')
  @ApiOperation({ summary: 'Replace a contact' })
  @ApiZodBody(contactInputSchema)
  updateContact(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @UuidParam('contactId') contactId: string,
    @ZodBody(contactInputSchema) body: ContactData,
  ): Promise<Contact> {
    return this.items.updateContact(user.userId, applicationId, contactId, body);
  }

  @Delete('contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiNoContentResponse()
  deleteContact(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @UuidParam('contactId') contactId: string,
  ): Promise<void> {
    return this.items.deleteContact(user.userId, applicationId, contactId);
  }

  @Post('interviews')
  @ApiOperation({ summary: 'Schedule an interview' })
  @ApiZodBody(interviewInputSchema)
  addInterview(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @ZodBody(interviewInputSchema) body: InterviewData,
  ): Promise<Interview> {
    return this.items.addInterview(user.userId, applicationId, body);
  }

  @Put('interviews/:interviewId')
  @ApiOperation({ summary: 'Replace an interview (e.g. record the outcome)' })
  @ApiZodBody(interviewInputSchema)
  updateInterview(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @UuidParam('interviewId') interviewId: string,
    @ZodBody(interviewInputSchema) body: InterviewData,
  ): Promise<Interview> {
    return this.items.updateInterview(user.userId, applicationId, interviewId, body);
  }

  @Delete('interviews/:interviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an interview' })
  @ApiNoContentResponse()
  deleteInterview(
    @CurrentUser() user: AuthUser,
    @UuidParam('applicationId') applicationId: string,
    @UuidParam('interviewId') interviewId: string,
  ): Promise<void> {
    return this.items.deleteInterview(user.userId, applicationId, interviewId);
  }
}
