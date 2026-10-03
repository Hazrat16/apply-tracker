import { type Tag, type TagInput, tagSchema } from '@apply-tracker/shared';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

export const tagsApi = {
  list: (signal?: AbortSignal) =>
    apiFetch<Tag[]>('/v1/tags', { schema: z.array(tagSchema), signal }),
  create: (body: TagInput) =>
    apiFetch<Tag>('/v1/tags', { method: 'POST', body, schema: tagSchema }),
  remove: (id: string) => apiFetch(`/v1/tags/${id}`, { method: 'DELETE' }),
};
