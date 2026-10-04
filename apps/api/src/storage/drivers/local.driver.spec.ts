import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageDriver } from './local.driver.js';

describe('LocalStorageDriver', () => {
  let dir: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'storage-'));
    driver = new LocalStorageDriver(dir);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('stores, replaces, reads and deletes files in nested folders', async () => {
    await driver.put('resumes/u1/a.pdf', Buffer.from('one'));
    await driver.put('resumes/u1/a.pdf', Buffer.from('two'));
    expect(Buffer.from((await driver.get('resumes/u1/a.pdf'))!).toString()).toBe('two');
    // No temp files are left behind.
    expect(await readdir(join(dir, 'resumes/u1'))).toEqual(['a.pdf']);

    await driver.delete('resumes/u1/a.pdf');
    expect(await driver.get('resumes/u1/a.pdf')).toBeNull();
  });

  it('treats missing files as absent', async () => {
    expect(await driver.get('nope.pdf')).toBeNull();
    await expect(driver.delete('nope.pdf')).resolves.toBeUndefined();
  });

  it('rejects keys that escape the storage folder', async () => {
    await expect(driver.get('../outside.pdf')).rejects.toThrow(/Invalid storage key/);
    await expect(driver.put('/etc/passwd', Buffer.from('x'))).rejects.toThrow(
      /Invalid storage key/,
    );
  });
});
