import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApplicationDetail,
  ApplicationList,
  ApplicationListParams,
  ApplicationStatus,
  ApplicationSummary,
  Company,
  CreateApplicationData,
  CsvImportResult,
  MoveApplicationInput,
  UpdateApplicationData,
} from '@apply-tracker/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  detailInclude,
  fromDateOnly,
  summaryInclude,
  toDetail,
  toSummary,
} from './application.mapper.js';
import { applicationsToCsv, parseApplicationsCsv } from './csv.js';
import { evenlySpacedPositions, POSITION_STEP, positionBetween } from './position.js';

type Tx = Prisma.TransactionClient;

/** The board shows at most this many cards (all statuses combined). */
const BOARD_LIMIT = 1000;

const SORT_ORDER: Record<
  ApplicationListParams['sort'],
  (order: Prisma.SortOrder) => Prisma.ApplicationOrderByWithRelationInput
> = {
  updatedAt: (order) => ({ updatedAt: order }),
  createdAt: (order) => ({ createdAt: order }),
  appliedAt: (order) => ({ appliedAt: { sort: order, nulls: 'last' } }),
  company: (order) => ({ company: { name: order } }),
  role: (order) => ({ roleTitle: order }),
  status: (order) => ({ status: order }),
};

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, params: ApplicationListParams): Promise<ApplicationList> {
    const where: Prisma.ApplicationWhereInput = {
      userId,
      archivedAt: params.archived ? { not: null } : null,
      ...(params.status?.length && { status: { in: params.status } }),
      ...(params.workMode?.length && { workMode: { in: params.workMode } }),
      ...(params.priority?.length && { priority: { in: params.priority } }),
      ...(params.source?.length && { source: { in: params.source } }),
      ...(params.tagId && { tags: { some: { id: params.tagId } } }),
      ...(params.search && {
        OR: [
          { roleTitle: { contains: params.search, mode: 'insensitive' } },
          { company: { name: { contains: params.search, mode: 'insensitive' } } },
          { location: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        include: summaryInclude(),
        // Secondary sort on id keeps pagination stable when the primary values tie.
        orderBy: [SORT_ORDER[params.sort](params.order), { id: 'asc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return { items: rows.map(toSummary), total, page: params.page, pageSize: params.pageSize };
  }

  /** Every active (non-archived) application, ordered for the Kanban columns. */
  async board(userId: string): Promise<ApplicationSummary[]> {
    const rows = await this.prisma.application.findMany({
      where: { userId, archivedAt: null },
      include: summaryInclude(),
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      take: BOARD_LIMIT,
    });
    return rows.map(toSummary);
  }

  async get(userId: string, id: string): Promise<ApplicationDetail> {
    const row = await this.prisma.application.findFirst({
      where: { id, userId },
      include: detailInclude(),
    });
    if (!row) throw new NotFoundException('Application not found');

    const allInterviews = await this.prisma.interview.findMany({
      where: { applicationId: id },
      orderBy: { scheduledAt: 'asc' },
    });
    return toDetail({ ...row, allInterviews });
  }

  async create(userId: string, data: CreateApplicationData): Promise<ApplicationDetail> {
    const id = await this.prisma.$transaction((tx) => this.createInTx(tx, userId, data));
    return this.get(userId, id);
  }

  async update(
    userId: string,
    id: string,
    data: UpdateApplicationData,
  ): Promise<ApplicationDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(tx, userId, id);
      const { companyName, tagIds, archived, appliedAt, status, ...fields } = data;

      const update: Prisma.ApplicationUpdateInput = { ...fields };
      if (appliedAt !== undefined) update.appliedAt = fromDateOnly(appliedAt);
      if (companyName !== undefined) {
        update.company = { connect: { id: await this.upsertCompany(tx, userId, companyName) } };
      }
      if (tagIds !== undefined) {
        await this.assertOwnTags(tx, userId, tagIds);
        update.tags = { set: tagIds.map((tagId) => ({ id: tagId })) };
      }
      if (archived !== undefined) update.archivedAt = archived ? new Date() : null;
      if (status !== undefined && status !== current.status) {
        update.status = status;
        update.position = await this.topOfColumn(tx, userId, status);
        update.statusHistory = { create: { fromStatus: current.status, toStatus: status } };
      }

      await tx.application.update({ where: { id }, data: update });
    });
    return this.get(userId, id);
  }

  /** Drag and drop: moves a card to a column, between two neighbouring cards. */
  async move(userId: string, id: string, input: MoveApplicationInput): Promise<ApplicationSummary> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(tx, userId, id);
      const neighbour = async (neighbourId?: string | null) => {
        if (!neighbourId) return null;
        if (neighbourId === id) throw new BadRequestException('A card cannot be its own neighbour');
        const row = await tx.application.findFirst({
          where: { id: neighbourId, userId, status: input.status, archivedAt: null },
          select: { id: true, position: true },
        });
        if (!row) throw new BadRequestException('Neighbouring card not found in that column');
        return row;
      };

      let before = await neighbour(input.beforeId);
      let after = await neighbour(input.afterId);
      let position = positionBetween(before?.position, after?.position);

      if (position === null) {
        // The gap is exhausted: renumber the column, then place the card again.
        await this.renumberColumn(tx, userId, input.status, id);
        before = await neighbour(input.beforeId);
        after = await neighbour(input.afterId);
        position = positionBetween(before?.position, after?.position) ?? 0;
      }

      await tx.application.update({
        where: { id },
        data: {
          status: input.status,
          position,
          ...(input.status !== current.status && {
            statusHistory: { create: { fromStatus: current.status, toStatus: input.status } },
          }),
        },
      });
    });

    const row = await this.prisma.application.findUniqueOrThrow({
      where: { id },
      include: summaryInclude(),
    });
    return toSummary(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.application.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Application not found');
  }

  async searchCompanies(userId: string, search?: string): Promise<Company[]> {
    return this.prisma.company.findMany({
      where: { userId, ...(search && { name: { contains: search, mode: 'insensitive' } }) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  async exportCsv(userId: string): Promise<string> {
    const rows = await this.prisma.application.findMany({
      where: { userId },
      include: summaryInclude(),
      orderBy: { createdAt: 'asc' },
    });
    return applicationsToCsv(rows.map(toSummary));
  }

  async importCsv(userId: string, file: Buffer): Promise<CsvImportResult> {
    let rows;
    try {
      rows = parseApplicationsCsv(file);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? `Could not read CSV: ${error.message}` : 'Could not read CSV',
      );
    }

    const result: CsvImportResult = { created: 0, errors: [] };
    for (const { row, data, error } of rows) {
      if (!data) {
        result.errors.push({ row, message: error ?? 'Invalid row' });
        continue;
      }
      const { tagNames, ...fields } = data;
      await this.prisma.$transaction(async (tx) => {
        const tagIds = await Promise.all(tagNames.map((name) => this.upsertTag(tx, userId, name)));
        await this.createInTx(tx, userId, { ...fields, tagIds });
      });
      result.created++;
    }
    return result;
  }

  /** Throws 404 unless the application exists and belongs to the user. */
  async assertOwned(userId: string, id: string): Promise<void> {
    await this.findOwned(this.prisma, userId, id);
  }

  private async createInTx(tx: Tx, userId: string, data: CreateApplicationData): Promise<string> {
    const { companyName, tagIds, appliedAt, ...fields } = data;
    await this.assertOwnTags(tx, userId, tagIds);
    const companyId = await this.upsertCompany(tx, userId, companyName);

    const application = await tx.application.create({
      data: {
        ...fields,
        appliedAt: fromDateOnly(appliedAt),
        position: await this.topOfColumn(tx, userId, fields.status),
        user: { connect: { id: userId } },
        company: { connect: { id: companyId } },
        tags: { connect: tagIds.map((id) => ({ id })) },
        statusHistory: { create: { fromStatus: null, toStatus: fields.status } },
      },
      select: { id: true },
    });
    return application.id;
  }

  private async findOwned(tx: Tx, userId: string, id: string) {
    const row = await tx.application.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    });
    if (!row) throw new NotFoundException('Application not found');
    return row;
  }

  /** New and re-statused cards go to the top of their column. */
  private async topOfColumn(tx: Tx, userId: string, status: ApplicationStatus): Promise<number> {
    const { _min } = await tx.application.aggregate({
      where: { userId, status, archivedAt: null },
      _min: { position: true },
    });
    return _min.position === null ? 0 : _min.position - POSITION_STEP;
  }

  private async renumberColumn(tx: Tx, userId: string, status: ApplicationStatus, skipId: string) {
    const cards = await tx.application.findMany({
      where: { userId, status, archivedAt: null, id: { not: skipId } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const positions = evenlySpacedPositions(cards.length);
    await Promise.all(
      cards.map((card, index) =>
        tx.application.update({ where: { id: card.id }, data: { position: positions[index] } }),
      ),
    );
  }

  private async upsertCompany(tx: Tx, userId: string, name: string): Promise<string> {
    const normalizedName = name.trim().toLowerCase();
    const company = await tx.company.upsert({
      where: { userId_normalizedName: { userId, normalizedName } },
      create: { userId, name: name.trim(), normalizedName },
      update: {},
      select: { id: true },
    });
    return company.id;
  }

  private async upsertTag(tx: Tx, userId: string, name: string): Promise<string> {
    const tag = await tx.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
      select: { id: true },
    });
    return tag.id;
  }

  private async assertOwnTags(tx: Tx, userId: string, tagIds: string[]) {
    if (tagIds.length === 0) return;
    const owned = await tx.tag.count({ where: { userId, id: { in: tagIds } } });
    if (owned !== new Set(tagIds).size) throw new BadRequestException('Unknown tag');
  }
}
