import * as Sentry from "@sentry/nextjs";

let sentryEnabled = false;

// No-ops entirely when NEXT_PUBLIC_SENTRY_DSN isn't set -- must never
// block boot or become a required setup step for an environment that
// doesn't have a Sentry project yet (local dev, CI, before launch).
// Browser-only: this app doesn't wrap next.config.ts with the Sentry
// webpack plugin (source maps/tunneling), so server-side error capture
// is intentionally out of scope here -- this closes the specific gap of
// unhandled client-side crashes going completely unreported.
export const initSentry = () => {
  if (sentryEnabled || typeof window === "undefined") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Error tracking only -- no performance/tracing sampling. Keep this
    // a cheap, always-on safety net, not something that needs tuning.
    tracesSampleRate: 0
  });
  sentryEnabled = true;
};

// Safe to call unconditionally from anywhere that catches an error --
// silently does nothing if Sentry was never initialized (no DSN, or
// running server-side).
export const captureException = (
  error: unknown,
  context?: Record<string, unknown>
) => {
  if (!sentryEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
};
