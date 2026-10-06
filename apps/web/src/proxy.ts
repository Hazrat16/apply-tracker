import { type NextRequest, NextResponse } from 'next/server';

/** Set by the API alongside the httpOnly auth cookies; signals that a session probably exists. */
const SESSION_HINT_COOKIE = 'logged_in';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/board',
  '/applications',
  '/calendar',
  '/settings',
  '/share',
];
const GUEST_ONLY = ['/login', '/register'];

/**
 * The browser never calls the API directly: `/api/*` is forwarded to it, so auth cookies are
 * first-party and no CORS is needed. Read per request, so a built image can point anywhere.
 */
const apiUrl = () => process.env.API_URL ?? 'http://localhost:4000';

/**
 * API forwarding, plus optimistic redirects — the API is the real authority. A stale hint cookie is
 * harmless: the API rejects the request, the client's refresh fails and clears it.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL(pathname + search, apiUrl()));
  }
  const hasSession = request.cookies.has(SESSION_HINT_COOKIE);

  if (
    !hasSession &&
    PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  if (hasSession && GUEST_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL('/board', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/board/:path*',
    '/applications/:path*',
    '/calendar/:path*',
    '/settings/:path*',
    '/share/:path*',
    '/login',
    '/register',
  ],
};
