import type { CookieOptions, Request, Response } from 'express';
import type { IssuedTokens } from './auth.types.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
/** Non-secret flag the web app's route proxy reads to know a session exists. */
export const SESSION_HINT_COOKIE = 'logged_in';

const REFRESH_PATH = '/api/v1/auth';

export interface CookieSettings {
  secure: boolean;
  accessTtlSeconds: number;
}

export function setAuthCookies(res: Response, tokens: IssuedTokens, settings: CookieSettings) {
  const base: CookieOptions = { httpOnly: true, secure: settings.secure };
  const refreshMaxAge = tokens.refreshExpiresAt.getTime() - Date.now();

  // Only sent to API routes.
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    sameSite: 'lax',
    path: '/api',
    maxAge: settings.accessTtlSeconds * 1000,
  });
  // Only sent to the auth endpoints that need it, and never cross-site.
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    sameSite: 'strict',
    path: REFRESH_PATH,
    maxAge: refreshMaxAge,
  });
  res.cookie(SESSION_HINT_COOKIE, '1', {
    ...base,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(res: Response, settings: CookieSettings) {
  const base: CookieOptions = { httpOnly: true, secure: settings.secure };
  res.clearCookie(ACCESS_COOKIE, { ...base, sameSite: 'lax', path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { ...base, sameSite: 'strict', path: REFRESH_PATH });
  res.clearCookie(SESSION_HINT_COOKIE, { ...base, sameSite: 'lax', path: '/' });
}

export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
