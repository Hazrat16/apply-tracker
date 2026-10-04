import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AI_MIN_JOB_DESCRIPTION,
  type AiStatus,
  type CoverLetter,
  type CreateCoverLetterData,
  type ResumeMatch,
  type UpdateCoverLetterInput,
} from '@apply-tracker/shared';
import type { Queue } from 'bullmq';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AI_QUEUE, AiJob, type AiJobData } from '../queue/queue.constants.js';
import { AI_WRITER, type AiWriter } from './writers/ai-writer.js';

const matchInclude = { resume: { select: { label: true } } } as const;
type MatchRow = Prisma.ResumeMatchGetPayload<{ include: typeof matchInclude }>;
const letterInclude = { resume: { select: { label: true } } } as const;
type LetterRow = Prisma.CoverLetterGetPayload<{ include: typeof letterInclude }>;

/** Most recent drafts kept per application; older ones are pruned. */
const MAX_LETTERS_PER_APPLICATION = 10;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_WRITER) private readonly writer: AiWriter,
    @InjectQueue(AI_QUEUE) private readonly queue: Queue<AiJobData>,
  ) {}

  status(): AiStatus {
    return { provider: this.writer.provider, model: this.writer.model };
  }

  async listMatches(userId: string, applicationId: string): Promise<ResumeMatch[]> {
    await this.findApplication(userId, applicationId);
    const rows = await this.prisma.resumeMatch.findMany({
      where: { applicationId },
      include: matchInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toMatch);
  }

  /** Queues a (re-)match of a resume against the application's job description. */
  async requestMatch(
    userId: string,
    applicationId: string,
    resumeId: string,
  ): Promise<ResumeMatch> {
    await this.checkInputs(userId, applicationId, resumeId);

    const existing = await this.prisma.resumeMatch.findUnique({
      where: { applicationId_resumeId: { applicationId, resumeId } },
      include: matchInclude,
    });
    // Already queued or running: don't pay for the same comparison twice.
    if (existing && (existing.status === 'PENDING' || existing.status === 'RUNNING')) {
      return toMatch(existing);
    }

    const reset = {
      status: 'PENDING' as const,
      score: null,
      summary: null,
      matchedSkills: [],
      missingSkills: [],
      suggestions: [],
      error: null,
      createdAt: new Date(),
      completedAt: null,
    };
    const row = await this.prisma.resumeMatch.upsert({
      where: { applicationId_resumeId: { applicationId, resumeId } },
      create: { applicationId, resumeId, ...reset },
      update: reset,
      include: matchInclude,
    });
    await this.queue.add(AiJob.ResumeMatch, { id: row.id });
    return toMatch(row);
  }

  async listCoverLetters(userId: string, applicationId: string): Promise<CoverLetter[]> {
    await this.findApplication(userId, applicationId);
    const rows = await this.prisma.coverLetter.findMany({
      where: { applicationId },
      include: letterInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toLetter);
  }

  async requestCoverLetter(
    userId: string,
    applicationId: string,
    input: CreateCoverLetterData,
  ): Promise<CoverLetter> {
    await this.checkInputs(userId, applicationId, input.resumeId);

    const row = await this.prisma.coverLetter.create({
      data: {
        applicationId,
        resumeId: input.resumeId,
        tone: input.tone,
        instructions: input.instructions ?? null,
      },
      include: letterInclude,
    });
    await this.queue.add(AiJob.CoverLetter, { id: row.id });

    const stale = await this.prisma.coverLetter.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_LETTERS_PER_APPLICATION,
      select: { id: true },
    });
    if (stale.length > 0) {
      await this.prisma.coverLetter.deleteMany({ where: { id: { in: stale.map((l) => l.id) } } });
    }
    return toLetter(row);
  }

  async updateCoverLetter(
    userId: string,
    id: string,
    input: UpdateCoverLetterInput,
  ): Promise<CoverLetter> {
    const { count } = await this.prisma.coverLetter.updateMany({
      where: { id, application: { userId }, status: 'DONE' },
      data: { content: input.content },
    });
    if (count === 0) throw new NotFoundException('Cover letter not found');
    return toLetter(
      await this.prisma.coverLetter.findUniqueOrThrow({ where: { id }, include: letterInclude }),
    );
  }

  async removeCoverLetter(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.coverLetter.deleteMany({
      where: { id, application: { userId } },
    });
    if (count === 0) throw new NotFoundException('Cover letter not found');
  }

  private async findApplication(userId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { jobDescription: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  /** Fails fast with a clear message instead of queueing a job that cannot succeed. */
  private async checkInputs(userId: string, applicationId: string, resumeId: string) {
    const application = await this.findApplication(userId, applicationId);
    if ((application.jobDescription?.trim().length ?? 0) < AI_MIN_JOB_DESCRIPTION) {
      throw new BadRequestException(
        'Add the job description to this application first (at least a paragraph)',
      );
    }
    const resume = await this.prisma.resume.findFirst({
      where: { id: resumeId, userId },
      select: { text: true },
    });
    if (!resume) throw new NotFoundException('Resume not found');
    if (!resume.text) {
      throw new BadRequestException(
        'This resume has no selectable text (it may be a scanned image) — upload a text-based PDF',
      );
    }
  }
}

function toMatch(row: MatchRow): ResumeMatch {
  return {
    id: row.id,
    applicationId: row.applicationId,
    resumeId: row.resumeId,
    resumeLabel: row.resume.label,
    status: row.status,
    score: row.score,
    summary: row.summary,
    matchedSkills: row.matchedSkills,
    missingSkills: row.missingSkills,
    suggestions: row.suggestions,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function toLetter(row: LetterRow): CoverLetter {
  return {
    id: row.id,
    applicationId: row.applicationId,
    resumeId: row.resumeId,
    resumeLabel: row.resume?.label ?? null,
    tone: row.tone,
    status: row.status,
    content: row.content,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
