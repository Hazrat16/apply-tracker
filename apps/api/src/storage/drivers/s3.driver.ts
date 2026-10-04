import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { StorageDriver } from './storage-driver.js';

export interface S3DriverOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
}

/** Any S3-compatible object store: AWS S3, Cloudflare R2, Backblaze B2, MinIO, Supabase… */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3';
  private readonly bucket: string;

  constructor(
    options: S3DriverOptions,
    private readonly client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
      maxAttempts: 3,
    }),
  ) {
    this.bucket = options.bucket;
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return object.Body ? await object.Body.transformToByteArray() : null;
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
