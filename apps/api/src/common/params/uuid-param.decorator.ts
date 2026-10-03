import { Param } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../zod/zod-validation.pipe.js';

/** Route param that must be a UUID (any version, including the v7 ids we generate). */
export const UuidParam = (name = 'id') => Param(name, new ZodValidationPipe(z.uuid()));
