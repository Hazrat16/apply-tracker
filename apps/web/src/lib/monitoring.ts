import { env } from './env';

type BrowserSentry = typeof import('@sentry/browser');

let sentry: Promise<BrowserSentry | null> | null = null;

/**
 * Optional browser error reporting, enabled by NEXT_PUBLIC_SENTRY_DSN. The SDK is
 * downloaded only when a DSN is configured, so it costs nothing otherwise.
 */
function load(): Promise<BrowserSentry | null> {
  if (!env.NEXT_PUBLIC_SENTRY_DSN || typeof window === 'undefined') return Promise.resolve(null);
  sentry ??= import('@sentry/browser').then((Sentry) => {
    Sentry.init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      // Errors only: no performance tracing or session replay.
      tracesSampleRate: 0,
    });
    return Sentry;
  });
  return sentry;
}

/** Starts listening for uncaught errors (no-op without a DSN). */
export function initMonitoring(): void {
  void load();
}

export function reportError(error: unknown): void {
  void load().then((Sentry) => Sentry?.captureException(error));
}
