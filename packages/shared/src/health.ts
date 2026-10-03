import { z } from 'zod';

const componentStatusSchema = z.record(z.string(), z.object({ status: z.enum(['up', 'down']) }));

/** Shape returned by `GET /api/health` (Terminus format). */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error', 'shutting_down']),
  info: componentStatusSchema.optional(),
  error: componentStatusSchema.optional(),
  details: componentStatusSchema,
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
