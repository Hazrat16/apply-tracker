import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type Resume,
  type ResumeDetail,
  RESUME_MAX_PER_USER,
  type UpdateResumeInput,
} from '@apply-tracker/shared';
import type { StorageDriverName } from '../config/env.js';
import type { Resume as ResumeRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { extractPdfText, PdfReadError } from './pdf-text.js';

const PDF = 'application/pdf';

export interface ResumeUpload {
  fileName: string;
  data: Uint8Array;
  label?: string;
}

export interface ResumeFile {
  fileName: string;
  contentType: string;
  data: Uint8Array;
}

@Injectable()
export class ResumesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string): Promise<Resume[]> {
    const rows = await this.prisma.resume.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toResume);
  }

  async get(userId: string, id: string): Promise<ResumeDetail> {
    const row = await this.find(userId, id);
    return { ...toResume(row), text: row.text };
  }

  async upload(userId: string, upload: ResumeUpload): Promise<ResumeDetail> {
    const count = await this.prisma.resume.count({ where: { userId } });
    if (count >= RESUME_MAX_PER_USER) {
      throw new ConflictException(
        `You can keep up to ${RESUME_MAX_PER_USER} resumes — delete one to upload another`,
      );
    }

    let extracted;
    try {
      extracted = await extractPdfText(upload.data);
    } catch (error) {
      if (error instanceof PdfReadError) throw new BadRequestException(error.message);
      throw error;
    }

    const fileName = cleanFileName(upload.fileName);
    const key = `resumes/${userId}/${randomUUID()}.pdf`;
    const driver = await this.storage.put(key, upload.data, PDF);
    try {
      const row = await this.prisma.resume.create({
        data: {
          userId,
          label: upload.label ?? fileName.replace(/\.pdf$/i, ''),
          fileName,
          contentType: PDF,
          sizeBytes: upload.data.byteLength,
          storageDriver: driver,
          storageKey: key,
          text: extracted.text,
          pageCount: extracted.pages,
        },
      });
      return { ...toResume(row), text: row.text };
    } catch (error) {
      await this.storage.deleteQuietly([{ driver, key }]);
      throw error;
    }
  }

  async update(userId: string, id: string, input: UpdateResumeInput): Promise<Resume> {
    const { count } = await this.prisma.resume.updateMany({
      where: { id, userId },
      data: { label: input.label },
    });
    if (count === 0) throw new NotFoundException('Resume not found');
    return toResume(await this.prisma.resume.findUniqueOrThrow({ where: { id } }));
  }

  async file(userId: string, id: string): Promise<ResumeFile> {
    const row = await this.find(userId, id);
    const data = await this.storage.get(row.storageDriver as StorageDriverName, row.storageKey);
    if (!data) throw new NotFoundException('The file for this resume is missing');
    return { fileName: row.fileName, contentType: row.contentType, data };
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.find(userId, id);
    await this.prisma.resume.delete({ where: { id: row.id } });
    await this.storage.deleteQuietly([
      { driver: row.storageDriver as StorageDriverName, key: row.storageKey },
    ]);
  }

  private async find(userId: string, id: string): Promise<ResumeRow> {
    const row = await this.prisma.resume.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Resume not found');
    return row;
  }
}

function toResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    label: row.label,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    hasText: row.text.length > 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Keeps the base name only, without control characters, and always ending in .pdf. */
function cleanFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    .replace(/["\p{Cc}]/gu, '')
    .trim()
    .slice(0, 120);
  if (!base) return 'resume.pdf';
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}
