import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { S3StorageDriver } from './s3.driver.js';

const options = { bucket: 'resumes', region: 'auto', forcePathStyle: false };

function driverWith(send: (command: unknown) => Promise<unknown>) {
  const client = { send: vi.fn(send) };
  return { client, driver: new S3StorageDriver(options, client as unknown as S3Client) };
}

describe('S3StorageDriver', () => {
  it('uploads with the bucket, key and content type', async () => {
    const { client, driver } = driverWith(() => Promise.resolve({}));
    await driver.put('resumes/u1/a.pdf', Buffer.from('pdf'), 'application/pdf');

    const command = client.send.mock.calls[0]![0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'resumes',
      Key: 'resumes/u1/a.pdf',
      ContentType: 'application/pdf',
    });
  });

  it('reads an object body', async () => {
    const { client, driver } = driverWith(() =>
      Promise.resolve({
        Body: { transformToByteArray: () => Promise.resolve(Buffer.from('pdf')) },
      }),
    );
    expect(Buffer.from((await driver.get('k'))!).toString()).toBe('pdf');
    expect(client.send.mock.calls[0]![0]).toBeInstanceOf(GetObjectCommand);
  });

  it('returns null for a missing object', async () => {
    const { driver } = driverWith(() =>
      Promise.reject(new NoSuchKey({ message: 'missing', $metadata: {} })),
    );
    expect(await driver.get('k')).toBeNull();
  });

  it('passes other errors through', async () => {
    const { driver } = driverWith(() => Promise.reject(new Error('AccessDenied')));
    await expect(driver.get('k')).rejects.toThrow('AccessDenied');
  });

  it('deletes an object', async () => {
    const { client, driver } = driverWith(() => Promise.resolve({}));
    await driver.delete('k');
    expect(client.send.mock.calls[0]![0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
