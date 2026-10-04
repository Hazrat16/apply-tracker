import {
  type Resume,
  type ResumeDetail,
  resumeDetailSchema,
  resumeSchema,
  type UpdateResumeInput,
} from '@apply-tracker/shared';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';
import { env } from '@/lib/env';

export const resumesApi = {
  list: (signal?: AbortSignal) =>
    apiFetch<Resume[]>('/v1/resumes', { schema: z.array(resumeSchema), signal }),
  upload: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiFetch<ResumeDetail>('/v1/resumes', {
      method: 'POST',
      body,
      schema: resumeDetailSchema,
    });
  },
  update: (id: string, body: UpdateResumeInput) =>
    apiFetch<Resume>(`/v1/resumes/${id}`, { method: 'PATCH', body, schema: resumeSchema }),
  remove: (id: string) => apiFetch(`/v1/resumes/${id}`, { method: 'DELETE' }),
  /** Opens in the browser's PDF viewer; the session cookie authorises it. */
  fileUrl: (id: string) => `${env.NEXT_PUBLIC_API_URL}/v1/resumes/${id}/file`,
};
