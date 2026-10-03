import {
  type ApplicationDetail,
  applicationDetailSchema,
  type ApplicationList,
  applicationListSchema,
  type ApplicationListQuery,
  type ApplicationSummary,
  applicationSummarySchema,
  type Company,
  companySchema,
  type Contact,
  type ContactInput,
  contactSchema,
  type CreateApplicationInput,
  type CsvImportResult,
  csvImportResultSchema,
  type Interview,
  type InterviewInput,
  interviewSchema,
  type MoveApplicationInput,
  type Note,
  type NoteInput,
  noteSchema,
  type UpdateApplicationInput,
} from '@apply-tracker/shared';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';
import { env } from '@/lib/env';

const base = '/v1/applications';

function queryString(query: ApplicationListQuery): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
      continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return search.toString();
}

export const applicationsApi = {
  list: (query: ApplicationListQuery, signal?: AbortSignal) =>
    apiFetch<ApplicationList>(`${base}?${queryString(query)}`, {
      schema: applicationListSchema,
      signal,
    }),
  board: (signal?: AbortSignal) =>
    apiFetch<ApplicationSummary[]>(`${base}/board`, {
      schema: z.array(applicationSummarySchema),
      signal,
    }),
  get: (id: string, signal?: AbortSignal) =>
    apiFetch<ApplicationDetail>(`${base}/${id}`, { schema: applicationDetailSchema, signal }),
  create: (body: CreateApplicationInput) =>
    apiFetch<ApplicationDetail>(base, { method: 'POST', body, schema: applicationDetailSchema }),
  update: (id: string, body: UpdateApplicationInput) =>
    apiFetch<ApplicationDetail>(`${base}/${id}`, {
      method: 'PATCH',
      body,
      schema: applicationDetailSchema,
    }),
  move: (id: string, body: MoveApplicationInput) =>
    apiFetch<ApplicationSummary>(`${base}/${id}/move`, {
      method: 'POST',
      body,
      schema: applicationSummarySchema,
    }),
  remove: (id: string) => apiFetch(`${base}/${id}`, { method: 'DELETE' }),
  companies: (search: string, signal?: AbortSignal) =>
    apiFetch<Company[]>(`/v1/companies?search=${encodeURIComponent(search)}`, {
      schema: z.array(companySchema),
      signal,
    }),
  importCsv: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiFetch<CsvImportResult>(`${base}/import`, {
      method: 'POST',
      body,
      schema: csvImportResultSchema,
    });
  },
  /** Plain link: the browser downloads the file using the session cookie. */
  exportUrl: `${env.NEXT_PUBLIC_API_URL}${base}/export`,

  addNote: (id: string, body: NoteInput) =>
    apiFetch<Note>(`${base}/${id}/notes`, { method: 'POST', body, schema: noteSchema }),
  updateNote: (id: string, noteId: string, body: NoteInput) =>
    apiFetch<Note>(`${base}/${id}/notes/${noteId}`, { method: 'PATCH', body, schema: noteSchema }),
  deleteNote: (id: string, noteId: string) =>
    apiFetch(`${base}/${id}/notes/${noteId}`, { method: 'DELETE' }),

  saveContact: (id: string, body: ContactInput, contactId?: string) =>
    apiFetch<Contact>(
      contactId ? `${base}/${id}/contacts/${contactId}` : `${base}/${id}/contacts`,
      {
        method: contactId ? 'PUT' : 'POST',
        body,
        schema: contactSchema,
      },
    ),
  deleteContact: (id: string, contactId: string) =>
    apiFetch(`${base}/${id}/contacts/${contactId}`, { method: 'DELETE' }),

  saveInterview: (id: string, body: InterviewInput, interviewId?: string) =>
    apiFetch<Interview>(
      interviewId ? `${base}/${id}/interviews/${interviewId}` : `${base}/${id}/interviews`,
      {
        method: interviewId ? 'PUT' : 'POST',
        body,
        schema: interviewSchema,
      },
    ),
  deleteInterview: (id: string, interviewId: string) =>
    apiFetch(`${base}/${id}/interviews/${interviewId}`, { method: 'DELETE' }),
};
