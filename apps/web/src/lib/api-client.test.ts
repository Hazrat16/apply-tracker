import { z } from 'zod';
import { jsonResponse } from '@/test/utils';
import { ApiError, apiFetch } from './api-client';

const schema = z.object({ id: z.string() });

describe('apiFetch', () => {
  it('returns parsed data and sends cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'a1' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/things/a1', { schema })).resolves.toEqual({ id: 'a1' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/things/a1',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
  });

  it('sends JSON bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/things', { method: 'POST', body: { name: 'x' } });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe('{"name":"x"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('throws ApiError with the server message and field issues', async () => {
    const issues = [{ path: 'email', message: 'Invalid email' }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'Validation failed', issues }, 400)),
    );

    const error = await apiFetch('/things', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'Validation failed', issues });
  });

  it('rejects responses that do not match the schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 42 })));
    await expect(apiFetch('/things/a1', { schema })).rejects.toThrow();
  });

  describe('expired access token', () => {
    it('refreshes the session once and retries', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
        .mockResolvedValueOnce(new Response(null, { status: 204 })) // refresh
        .mockResolvedValueOnce(jsonResponse({ id: 'a1' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(apiFetch('/things/a1', { schema })).resolves.toEqual({ id: 'a1' });
      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
        '/api/things/a1',
        '/api/v1/auth/refresh',
        '/api/things/a1',
      ]);
    });

    it('shares one refresh between concurrent requests', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.endsWith('/auth/refresh'))
          return Promise.resolve(new Response(null, { status: 204 }));
        const authed = fetchMock.mock.calls.some((call) => call[0].endsWith('/auth/refresh'));
        return Promise.resolve(authed ? jsonResponse({ id: 'ok' }) : jsonResponse({}, 401));
      });
      vi.stubGlobal('fetch', fetchMock);

      await Promise.all([apiFetch('/a', { schema }), apiFetch('/b', { schema })]);
      expect(fetchMock.mock.calls.filter((call) => call[0].endsWith('/auth/refresh'))).toHaveLength(
        1,
      );
    });

    it('gives up with 401 when the refresh fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401)),
      );
      await expect(apiFetch('/things/a1', { schema })).rejects.toMatchObject({ status: 401 });
    });

    it('does not refresh when login credentials are wrong', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ message: 'Invalid email or password' }, 401));
      vi.stubGlobal('fetch', fetchMock);

      await expect(apiFetch('/v1/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
        message: 'Invalid email or password',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
