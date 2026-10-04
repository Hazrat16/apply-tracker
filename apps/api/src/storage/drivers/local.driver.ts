import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { StorageDriver } from './storage-driver.js';

/**
 * Keeps files in a folder on disk. Fine for development or a server with a persistent volume;
 * on free hosts with ephemeral disks (Render, Railway, Fly without a volume) files vanish on
 * every deploy — use `database` or `s3` there.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    // Write then rename, so a crash never leaves a half-written file behind.
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, data);
    await rename(temp, path);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  /** Absolute path for a key; rejects keys that would escape the storage folder. */
  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return path;
  }
}
