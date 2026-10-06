import * as Sentry from '@sentry/node';

/**
 * Optional error reporting. Enabled only when SENTRY_DSN is set — works with Sentry's free
 * plan or a self-hosted, Sentry-compatible server such as GlitchTip. Call before the app
 * starts. Without a DSN every Sentry call is a no-op.
 */
export function initMonitoring(service: 'api' | 'worker'): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    initialScope: { tags: { service } },
    // Errors only: no performance tracing, which keeps usage inside free quotas.
    tracesSampleRate: 0,
  });
}

export { Sentry };
