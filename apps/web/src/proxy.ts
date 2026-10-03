import { type NextRequest, NextResponse } from 'next/server';

/** Set by the API alongside the httpOnly auth cookies; signals that a session probably exists. */
const SESSION_HINT_COOKIE = 'logged_in';

const PROTECTED_PREFIXES = ['/dashboard', '/board', '/applications', '/settings', '/share'];
const GUEST_ONLY = ['/login', '/register'];

/**
 * Optimistic redirects only — the API is the real authority. A stale hint cookie is
 * harmless: the API rejects the request, the client's refresh fails and clears it.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
    '/dashboard/:path*',
    '/board/:path*',
    '/applications/:path*',
    '/settings/:path*',
    '/share/:path*',
    '/login',
    '/register',
  ],
};
