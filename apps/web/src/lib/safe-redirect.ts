/**
 * Returns `next` only if it is a same-site path, preventing open redirects
 * like `/login?next=https://evil.example`.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = '/board'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}
