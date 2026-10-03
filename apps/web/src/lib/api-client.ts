import type { z } from 'zod';
import { env } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function errorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body as { message: unknown };
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return undefined;
}

/**
 * Calls the API and validates the JSON response against `schema`,
 * so a contract change in the backend fails loudly instead of silently.
 */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  });

  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body) ?? res.statusText, body);
  }
  return schema.parse(body);
}
