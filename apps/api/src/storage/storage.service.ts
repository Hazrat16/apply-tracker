import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env, resolveStorageDriver, type StorageDriverName } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DatabaseStorageDriver } from './drivers/database.driver.js';
import { LocalStorageDriver } from './drivers/local.driver.js';
import { S3StorageDriver } from './drivers/s3.driver.js';
import type { StorageDriver } from './drivers/storage-driver.js';

/**
 * File storage with interchangeable drivers. New files go to the active driver
 * (STORAGE_DRIVER, or S3 when a bucket is set, else Postgres). Callers record which driver
 * stored each file, so reads and deletes still work after switching — e.g. back to the
 * database driver while the S3 bucket is offline.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly drivers = new Map<StorageDriverName, StorageDriver>();
  readonly active: StorageDriverName;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.active = resolveStorageDriver({
      STORAGE_DRIVER: config.get('STORAGE_DRIVER', { infer: true }),
      S3_BUCKET: config.get('S3_BUCKET', { infer: true }),
    });
    this.logger.log(`File storage: ${this.active}`);
    if (this.active === 'local' && config.get('NODE_ENV', { infer: true }) === 'production') {
      this.logger.warn(
        'STORAGE_DRIVER=local keeps files on this machine — they are lost if the disk is ephemeral',
      );
    }
  }

  /** Stores a file with the active driver and returns that driver's name. */
  async put(key: string, data: Uint8Array, contentType: string): Promise<StorageDriverName> {
    await this.driver(this.active).put(key, data, contentType);
    return this.active;
  }

  get(driver: StorageDriverName, key: string): Promise<Uint8Array | null> {
    return this.driver(driver).get(key);
  }

  delete(driver: StorageDriverName, key: string): Promise<void> {
    return this.driver(driver).delete(key);
  }

  /** Deletes files without failing the caller; a file that can't be removed is only logged. */
  async deleteQuietly(files: { driver: StorageDriverName; key: string }[]): Promise<void> {
    // `async` so a driver that can't even be created (S3 not configured) is a rejection too.
    const results = await Promise.allSettled(files.map(async (f) => this.delete(f.driver, f.key)));
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          { err: result.reason as unknown },
          `Could not delete ${files[i]!.driver} file ${files[i]!.key}`,
        );
      }
    });
  }

  /** Drivers are created on first use, so an unused S3 config is never touched. */
  private driver(name: StorageDriverName): StorageDriver {
    let driver = this.drivers.get(name);
    if (!driver) {
      driver = this.createDriver(name);
      this.drivers.set(name, driver);
    }
    return driver;
  }

  private createDriver(name: StorageDriverName): StorageDriver {
    switch (name) {
      case 'database':
        return new DatabaseStorageDriver(this.prisma);
      case 'local':
        return new LocalStorageDriver(this.config.get('STORAGE_LOCAL_DIR', { infer: true }));
      case 's3': {
        const bucket = this.config.get('S3_BUCKET', { infer: true });
        if (!bucket) {
          throw new ServiceUnavailableException(
            'This file is kept in S3 storage, which is not configured right now',
          );
        }
        return new S3StorageDriver({
          bucket,
          region: this.config.get('S3_REGION', { infer: true }),
          endpoint: this.config.get('S3_ENDPOINT', { infer: true }),
          accessKeyId: this.config.get('S3_ACCESS_KEY_ID', { infer: true }),
          secretAccessKey: this.config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
          forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE', { infer: true }),
        });
      }
    }
  }
}
