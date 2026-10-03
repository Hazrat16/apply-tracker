import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Tag, type TagData, tagInputSchema } from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UuidParam } from '../common/params/uuid-param.decorator.js';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import { TagsService } from './tags.service.js';

@ApiTags('tags')
@ApiCookieAuth()
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'All tags of the signed-in user' })
  list(@CurrentUser() user: AuthUser): Promise<Tag[]> {
    return this.tags.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a tag' })
  @ApiZodBody(tagInputSchema)
  create(@CurrentUser() user: AuthUser, @ZodBody(tagInputSchema) body: TagData): Promise<Tag> {
    return this.tags.create(user.userId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or recolour a tag' })
  @ApiZodBody(tagInputSchema)
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(tagInputSchema) body: TagData,
  ): Promise<Tag> {
    return this.tags.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag (removes it from applications)' })
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    return this.tags.remove(user.userId, id);
  }
}
