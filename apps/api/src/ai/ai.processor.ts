import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { AI_QUEUE, AiJob, type AiJobData } from '../queue/queue.constants.js';
import {
  AI_WRITER,
  type AiWriter,
  type JobPosting,
  PermanentAiError,
} from './writers/ai-writer.js';

const FAILED_MESSAGE = 'The AI request failed. Try again in a few minutes.';

/**
 * Fills in resume matches and cover letters with the configured AiWriter. Rows move PENDING → RUNNING →
 * DONE/FAILED; temporary API errors are retried by the queue before a row is marked FAILED.
 */
@Processor(AI_QUEUE, { concurrency: 2 })
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_WRITER) private readonly writer: AiWriter,
  ) {
    super();
  }

  async process(job: Job<AiJobData>): Promise<void> {
    try {
      if (job.name === AiJob.ResumeMatch) await this.match(job.data.id);
      else if (job.name === AiJob.CoverLetter) await this.coverLetter(job.data.id);
    } catch (error) {
      const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (!(error instanceof PermanentAiError) && !lastAttempt) throw error;

      this.logger.warn({ err: error as unknown }, `AI job ${job.name} ${job.data.id} failed`);
      const data = { status: 'FAILED', error: FAILED_MESSAGE } as const;
      if (job.name === AiJob.ResumeMatch) {
        await this.prisma.resumeMatch.updateMany({
          where: { id: job.data.id },
          data: { ...data, completedAt: new Date() },
        });
      } else {
        await this.prisma.coverLetter.updateMany({ where: { id: job.data.id }, data });
      }
    }
  }

  private async match(id: string): Promise<void> {
    const row = await this.prisma.resumeMatch.findUnique({
      where: { id },
      include: { resume: { select: { text: true } }, application: { include: { company: true } } },
    });
    // Deleted in the meantime, or a stale job for a row that was already re-run.
    if (!row || row.status === 'DONE') return;

    await this.prisma.resumeMatch.update({ where: { id }, data: { status: 'RUNNING' } });
    const result = await this.writer.matchResume(row.resume.text, posting(row.application));
    await this.prisma.resumeMatch.updateMany({
      where: { id },
      data: {
        status: 'DONE',
        score: Math.round(Math.min(100, Math.max(0, result.score))),
        summary: result.summary.trim(),
        matchedSkills: clean(result.matchedSkills),
        missingSkills: clean(result.missingSkills),
        suggestions: clean(result.suggestions).slice(0, 5),
        error: null,
        completedAt: new Date(),
      },
    });
  }

  private async coverLetter(id: string): Promise<void> {
    const row = await this.prisma.coverLetter.findUnique({
      where: { id },
      include: { resume: { select: { text: true } }, application: { include: { company: true } } },
    });
    if (!row || row.status === 'DONE') return;
    if (!row.resume) throw new PermanentAiError('The resume was deleted');

    await this.prisma.coverLetter.update({ where: { id }, data: { status: 'RUNNING' } });
    const content = await this.writer.writeCoverLetter(row.resume.text, posting(row.application), {
      tone: row.tone,
      instructions: row.instructions,
    });
    await this.prisma.coverLetter.updateMany({
      where: { id },
      data: { status: 'DONE', content, error: null },
    });
  }
}

function posting(application: {
  roleTitle: string;
  jobDescription: string | null;
  company: { name: string };
}): JobPosting {
  return {
    roleTitle: application.roleTitle,
    companyName: application.company.name,
    description: application.jobDescription ?? '',
  };
}

const clean = (items: string[]) =>
  [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, 12);
