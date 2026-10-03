import { applyDecorators, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import type { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

/** Validated query string: `@ZodQuery(listQuerySchema) query: ListParams`. */
export const ZodQuery = (schema: z.ZodType) => Query(new ZodValidationPipe(schema));

/** Documents each key of a Zod object schema as an optional query parameter in Swagger. */
export const ApiZodQuery = (schema: z.ZodObject) =>
  applyDecorators(
    ...Object.keys(schema.shape).map((name) => ApiQuery({ name, required: false, type: String })),
  );
