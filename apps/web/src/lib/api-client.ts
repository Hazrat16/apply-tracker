import type { z } from 'zod';
import { env } from './env';

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly issues: FieldIssue[];

  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.issues = readIssues(body);
  }
}

function readIssues(body: unknown): FieldIssue[] {
  if (body && typeof body === 'object' && 'issues' in body && Array.isArray(body.issues)) {
    return body.issues as FieldIssue[];
  }
  return [];
}

function errorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body as { message: unknown };
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return undefined;
}

// Endpoints where a 401 means "wrong credentials", not "access token expired".
const NO_REFRESH_PATHS = ['/v1/auth/login', '/v1/auth/register', '/v1/auth/refresh'];

let refreshInFlight: Promise<boolean> | null = null;

/** Rotates the session cookies. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${env.NEXT_PUBLIC_API_URL}/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Validates the JSON response; omit for endpoints that return no content. */
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
}

/**
 * Calls the API with cookies. If the access token has expired it refreshes the session
 * once and retries. Responses are validated against `schema`, so a backend contract
 * change fails loudly instead of silently.
 */
export async function apiFetch<T = void>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  // FormData (file uploads) is sent as multipart; the browser sets the boundary header.
  const isForm = options.body instanceof FormData;
  const send = () =>
    fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      signal: options.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
      },
      body: isForm
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });

  let res = await send();
  if (res.status === 401 && !NO_REFRESH_PATHS.includes(path) && (await refreshSession())) {
    res = await send();
  }

  const body: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body) ?? res.statusText, body);
  }
  return (options.schema ? options.schema.parse(body) : undefined) as T;
}

export const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;
