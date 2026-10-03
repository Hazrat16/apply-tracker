import { NextRequest } from 'next/server';
import { proxy } from './proxy';

function request(path: string, loggedIn: boolean) {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    headers: loggedIn ? { cookie: 'logged_in=1' } : {},
  });
}

describe('proxy', () => {
  it('sends signed-out visitors to login and remembers where they were going', () => {
    const res = proxy(request('/settings?tab=security', false));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fsettings%3Ftab%3Dsecurity',
    );
  });

  it('lets signed-in users through to protected pages', () => {
    expect(proxy(request('/dashboard', true)).headers.get('location')).toBeNull();
  });

  it('sends signed-in users away from the login page', () => {
    expect(proxy(request('/login', true)).headers.get('location')).toBe(
      'http://localhost:3000/dashboard',
    );
  });

  it('shows the login page to signed-out visitors', () => {
    expect(proxy(request('/login', false)).headers.get('location')).toBeNull();
  });
});
