import type { StorageDriverName } from '../../config/env.js';

/**
 * A place to keep uploaded files. Files are small (resumes, a few MB), so drivers read and
 * write whole buffers instead of streams.
 */
export interface StorageDriver {
  readonly name: StorageDriverName;
  /** Creates or replaces the file at `key`. */
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  /** File contents, or `null` if there is no file at `key`. */
  get(key: string): Promise<Uint8Array | null>;
  /** Removes the file; succeeds if it is already gone. */
  delete(key: string): Promise<void>;
}
