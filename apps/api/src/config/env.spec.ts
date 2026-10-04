import { resolveStorageDriver, validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it('splits comma-separated CORS origins', () => {
    const env = validateEnv({ ...base, CORS_ORIGINS: 'https://a.com, https://b.com' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('treats empty strings as unset', () => {
    expect(validateEnv({ ...base, GOOGLE_CLIENT_ID: '' }).GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('throws when DATABASE_URL is missing or not postgres', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });
});

describe('storage settings', () => {
  it('falls back to the database driver without an S3 bucket', () => {
    expect(resolveStorageDriver(validateEnv(base))).toBe('database');
  });

  it('uses S3 when a bucket is set, unless another driver is chosen', () => {
    expect(resolveStorageDriver(validateEnv({ ...base, S3_BUCKET: 'resumes' }))).toBe('s3');
    expect(
      resolveStorageDriver(validateEnv({ ...base, S3_BUCKET: 'resumes', STORAGE_DRIVER: 'local' })),
    ).toBe('local');
  });

  it('requires a bucket for the s3 driver', () => {
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
  });

  it('requires both S3 keys or neither', () => {
    expect(() => validateEnv({ ...base, S3_ACCESS_KEY_ID: 'id' })).toThrow(/S3_SECRET_ACCESS_KEY/);
  });

  it('rejects an unknown driver', () => {
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 'ftp' })).toThrow(/STORAGE_DRIVER/);
  });
});
