import { z } from 'zod';
import { jsonResponse } from '@/test/utils';
import { ApiError, apiFetch } from './api-client';

const schema = z.object({ id: z.string() });

describe('apiFetch', () => {
  it('returns parsed data and sends cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'a1' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/things/a1', schema)).resolves.toEqual({ id: 'a1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/things/a1',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws ApiError with the server message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ statusCode: 404, message: 'Not found' }, 404)),
    );

    await expect(apiFetch('/things/x', schema)).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Not found',
    } satisfies Partial<ApiError>);
  });

  it('rejects responses that do not match the schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 42 })));
    await expect(apiFetch('/things/a1', schema)).rejects.toThrow();
  });
});
