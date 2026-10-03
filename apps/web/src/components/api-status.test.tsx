import { screen } from '@testing-library/react';
import { jsonResponse, renderWithQuery } from '@/test/utils';
import { ApiStatus } from './api-status';

const healthy = {
  status: 'ok',
  info: { database: { status: 'up' } },
  error: {},
  details: { database: { status: 'up' } },
};

describe('ApiStatus', () => {
  it('shows online when the health check passes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(healthy)));
    renderWithQuery(<ApiStatus />);
    expect(await screen.findByText('API online')).toBeInTheDocument();
  });

  it('shows degraded when a dependency is down (503)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ...healthy, status: 'error' }, 503)),
    );
    renderWithQuery(<ApiStatus />);
    expect(await screen.findByText('API degraded')).toBeInTheDocument();
  });

  it('shows offline when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderWithQuery(<ApiStatus />);
    expect(await screen.findByText('API offline')).toBeInTheDocument();
  });
});
