import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type Resume,
  type ResumeDetail,
  RESUME_MAX_BYTES,
  resumeLabelSchema,
  type UpdateResumeInput,
  updateResumeSchema,
} from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UuidParam } from '../common/params/uuid-param.decorator.js';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe.js';
import { ResumesService } from './resumes.service.js';

@ApiTags('resumes')
@ApiCookieAuth()
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Get()
  @ApiOperation({ summary: 'Resumes of the signed-in user, newest first' })
  list(@CurrentUser() user: AuthUser): Promise<Resume[]> {
    return this.resumes.list(user.userId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: RESUME_MAX_BYTES, files: 1 } }))
  @ApiOperation({
    summary: 'Upload a resume PDF (max 5 MB); its text is extracted for AI features',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        label: { type: 'string', description: 'Defaults to the file name' },
      },
    },
  })
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('label', new ZodValidationPipe(resumeLabelSchema.optional())) label: string | undefined,
  ): Promise<ResumeDetail> {
    if (!file) throw new BadRequestException('Attach a PDF in the "file" field');
    return this.resumes.upload(user.userId, {
      fileName: file.originalname,
      data: file.buffer,
      label,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'A resume with its extracted text' })
  get(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<ResumeDetail> {
    return this.resumes.get(user.userId, id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'The original PDF' })
  @ApiProduces('application/pdf')
  @ApiQuery({ name: 'download', required: false, type: Boolean })
  async file(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Query('download') download?: string,
  ): Promise<StreamableFile> {
    const file = await this.resumes.file(user.userId, id);
    const type = download === 'true' ? 'attachment' : 'inline';
    return new StreamableFile(file.data, {
      type: file.contentType,
      length: file.data.byteLength,
      disposition: contentDisposition(type, file.fileName),
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a resume' })
  @ApiZodBody(updateResumeSchema)
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(updateResumeSchema) body: UpdateResumeInput,
  ): Promise<Resume> {
    return this.resumes.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resume and its file' })
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    return this.resumes.remove(user.userId, id);
  }
}

/** RFC 6266 header with an ASCII fallback name plus the exact UTF-8 name. */
function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
