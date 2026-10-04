import type { PrismaService } from '../../prisma/prisma.service.js';
import type { StorageDriver } from './storage-driver.js';

/**
 * Keeps files in Postgres. The fallback when no S3 bucket is configured: it needs no extra
 * service or account, and files survive restarts on hosts whose disks are ephemeral.
 */
export class DatabaseStorageDriver implements StorageDriver {
  readonly name = 'database';

  constructor(private readonly prisma: PrismaService) {}

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    const bytes = new Uint8Array(data);
    await this.prisma.storedFile.upsert({
      where: { key },
      create: { key, data: bytes, contentType },
      update: { data: bytes, contentType },
    });
  }

  async get(key: string): Promise<Uint8Array | null> {
    const file = await this.prisma.storedFile.findUnique({
      where: { key },
      select: { data: true },
    });
    return file?.data ?? null;
  }

  async delete(key: string): Promise<void> {
    await this.prisma.storedFile.deleteMany({ where: { key } });
  }
}
