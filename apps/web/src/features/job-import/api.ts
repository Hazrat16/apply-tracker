import {
  type JobImportCapabilities,
  jobImportCapabilitiesSchema,
  type JobPreview,
  jobPreviewSchema,
  type JobTextInput,
} from '@apply-tracker/shared';
import { apiFetch } from '@/lib/api-client';

export const jobImportApi = {
  capabilities: () =>
    apiFetch<JobImportCapabilities>('/v1/job-imports/capabilities', {
      schema: jobImportCapabilitiesSchema,
    }),
  previewLink: (url: string) =>
    apiFetch<JobPreview>('/v1/job-imports/preview-link', {
      method: 'POST',
      body: { url },
      schema: jobPreviewSchema,
    }),
  previewText: (input: JobTextInput) =>
    apiFetch<JobPreview>('/v1/job-imports/preview-text', {
      method: 'POST',
      body: input,
      schema: jobPreviewSchema,
    }),
};
