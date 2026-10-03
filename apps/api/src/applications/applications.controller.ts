import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
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
  ApiTags,
} from '@nestjs/swagger';
import {
  type ApplicationDetail,
  type ApplicationList,
  type ApplicationListParams,
  applicationListQuerySchema,
  type ApplicationSummary,
  type Company,
  type CreateApplicationData,
  createApplicationSchema,
  type CsvImportResult,
  type MoveApplicationInput,
  moveApplicationSchema,
  type UpdateApplicationData,
  updateApplicationSchema,
} from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UuidParam } from '../common/params/uuid-param.decorator.js';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import { ApiZodQuery, ZodQuery } from '../common/zod/zod-query.decorator.js';
import { ApplicationsService } from './applications.service.js';

const MAX_CSV_BYTES = 1024 * 1024;

@ApiTags('applications')
@ApiCookieAuth()
@Controller()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  // Static paths are declared before `applications/:id` so they aren't parsed as ids.

  @Get('applications')
  @ApiOperation({ summary: 'Search, filter, sort and paginate applications' })
  @ApiZodQuery(applicationListQuerySchema)
  list(
    @CurrentUser() user: AuthUser,
    @ZodQuery(applicationListQuerySchema) query: ApplicationListParams,
  ): Promise<ApplicationList> {
    return this.applications.list(user.userId, query);
  }

  @Get('applications/board')
  @ApiOperation({ summary: 'All active applications, ordered for the Kanban board' })
  board(@CurrentUser() user: AuthUser): Promise<ApplicationSummary[]> {
    return this.applications.board(user.userId);
  }

  @Get('applications/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="applications.csv"')
  @ApiOperation({ summary: 'Download all applications as CSV' })
  @ApiProduces('text/csv')
  exportCsv(@CurrentUser() user: AuthUser): Promise<string> {
    return this.applications.exportCsv(user.userId);
  }

  @Post('applications/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES, files: 1 } }))
  @ApiOperation({ summary: 'Create applications from a CSV file (max 1 MB, 1000 rows)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  importCsv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<CsvImportResult> {
    if (!file) throw new BadRequestException('Attach a CSV file in the "file" field');
    if (!/\.csv$/i.test(file.originalname) && !file.mimetype.includes('csv')) {
      throw new BadRequestException('Only .csv files can be imported');
    }
    return this.applications.importCsv(user.userId, file.buffer);
  }

  @Post('applications')
  @ApiOperation({ summary: 'Create an application (the company is created if new)' })
  @ApiZodBody(createApplicationSchema)
  create(
    @CurrentUser() user: AuthUser,
    @ZodBody(createApplicationSchema) body: CreateApplicationData,
  ): Promise<ApplicationDetail> {
    return this.applications.create(user.userId, body);
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Application with notes, contacts, interviews and history' })
  get(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<ApplicationDetail> {
    return this.applications.get(user.userId, id);
  }

  @Patch('applications/:id')
  @ApiOperation({ summary: 'Update fields, tags, status or archive state' })
  @ApiZodBody(updateApplicationSchema)
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(updateApplicationSchema) body: UpdateApplicationData,
  ): Promise<ApplicationDetail> {
    return this.applications.update(user.userId, id, body);
  }

  @Post('applications/:id/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move a card on the board (column and position)' })
  @ApiZodBody(moveApplicationSchema)
  move(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(moveApplicationSchema) body: MoveApplicationInput,
  ): Promise<ApplicationSummary> {
    return this.applications.move(user.userId, id, body);
  }

  @Delete('applications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete an application' })
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    return this.applications.remove(user.userId, id);
  }

  @Get('companies')
  @ApiTags('companies')
  @ApiOperation({ summary: 'Companies for autocomplete' })
  companies(@CurrentUser() user: AuthUser, @Query('search') search?: string): Promise<Company[]> {
    return this.applications.searchCompanies(user.userId, search?.trim().slice(0, 100));
  }
}
