import { applyDecorators, Body } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

/** Validated request body: `@ZodBody(loginSchema) body: LoginInput`. */
export const ZodBody = (schema: z.ZodType) => Body(new ZodValidationPipe(schema));

/** Documents a Zod request body in Swagger, generated from the same schema used for validation. */
export const ApiZodBody = (schema: z.ZodType) =>
  applyDecorators(
    ApiBody({
      schema: z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }) as object,
    }),
    ApiBadRequestResponse({ description: 'Validation failed' }),
  );
