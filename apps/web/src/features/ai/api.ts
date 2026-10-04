import {
  type AiStatus,
  aiStatusSchema,
  type CoverLetter,
  coverLetterSchema,
  type CreateCoverLetterInput,
  type ResumeMatch,
  resumeMatchSchema,
  type UpdateCoverLetterInput,
} from '@apply-tracker/shared';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

export const aiApi = {
  status: (signal?: AbortSignal) =>
    apiFetch<AiStatus>('/v1/ai/status', { schema: aiStatusSchema, signal }),
  matches: (applicationId: string, signal?: AbortSignal) =>
    apiFetch<ResumeMatch[]>(`/v1/applications/${applicationId}/matches`, {
      schema: z.array(resumeMatchSchema),
      signal,
    }),
  requestMatch: (applicationId: string, resumeId: string) =>
    apiFetch<ResumeMatch>(`/v1/applications/${applicationId}/matches`, {
      method: 'POST',
      body: { resumeId },
      schema: resumeMatchSchema,
    }),
  coverLetters: (applicationId: string, signal?: AbortSignal) =>
    apiFetch<CoverLetter[]>(`/v1/applications/${applicationId}/cover-letters`, {
      schema: z.array(coverLetterSchema),
      signal,
    }),
  requestCoverLetter: (applicationId: string, body: CreateCoverLetterInput) =>
    apiFetch<CoverLetter>(`/v1/applications/${applicationId}/cover-letters`, {
      method: 'POST',
      body,
      schema: coverLetterSchema,
    }),
  updateCoverLetter: (id: string, body: UpdateCoverLetterInput) =>
    apiFetch<CoverLetter>(`/v1/cover-letters/${id}`, {
      method: 'PATCH',
      body,
      schema: coverLetterSchema,
    }),
  removeCoverLetter: (id: string) => apiFetch(`/v1/cover-letters/${id}`, { method: 'DELETE' }),
};
