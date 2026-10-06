import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jsonResponse, renderWithQuery } from '@/test/utils';
import { LoginForm } from './login-form';

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

const user = {
  id: 'u1',
  email: 'jane@example.com',
  name: 'Jane',
  avatarUrl: null,
  emailVerified: true,
  hasPassword: true,
  providers: [],
  isDemo: false,
  demoExpiresAt: null,
  createdAt: new Date().toISOString(),
};

function mockApi(login: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/auth/providers') ? jsonResponse({ google: false, demo: false }) : login,
      ),
    ),
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    replace.mockReset();
    searchParams = new URLSearchParams();
  });

  it('validates fields before calling the API', async () => {
    mockApi(jsonResponse(user));
    renderWithQuery(<LoginForm />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith('/api/v1/auth/login', expect.anything());
  });

  it('signs in and returns to the requested page', async () => {
    searchParams = new URLSearchParams({ next: '/settings' });
    mockApi(jsonResponse(user));
    renderWithQuery(<LoginForm />);

    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/settings'));
  });

  it('shows the server error for wrong credentials', async () => {
    mockApi(jsonResponse({ statusCode: 401, message: 'Invalid email or password' }, 401));
    renderWithQuery(<LoginForm />);

    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
