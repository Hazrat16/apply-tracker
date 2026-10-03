import { createHash, randomBytes } from 'node:crypto';

/** 256-bit URL-safe random token. */
export const generateToken = (): string => randomBytes(32).toString('base64url');

/**
 * Tokens are stored as SHA-256 hashes: they are high-entropy random values, so a fast
 * hash is enough, and a leaked database row can't be replayed as a valid token.
 */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
