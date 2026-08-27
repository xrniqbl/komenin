/**
 * Error Reporting
 *
 * Central, provider-agnostic error reporter. Ships unhandled server errors to
 * Sentry (via the lightweight store endpoint ingest API) when `SENTRY_DSN` is
 * configured; otherwise logs locally. Never throws — reporting must not take
 * the request path down.
 *
 * Sentry store endpoint: POST https://<host>/api/<projectId>/store/
 * with X-Sentry-Auth header (Sentry <protocol>, sentry_key=<publicKey>).
 */

import crypto from "node:crypto";

type ErrorContext = {
  /** e.g. "/api/v1/leads" or "worker:comment.send" */
  scope: string;
  userId?: string | null;
  workspaceId?: string | null;
  requestId?: string | null;
  extra?: Record<string, unknown>;
};

type SentryTarget = { url: string; publicKey: string; secretKey: string };

function parseDsn(dsn: string): SentryTarget | null {
  // https://<publicKey>[:<secretKey>]@<host>/<projectId>
  const match = dsn.match(/^https?:\/\/([^:@/]+)(?::([^@/]+))?@([^/]+)\/(\d+)$/);
  if (!match) return null;
  const [, publicKey, secretKey, host, projectId] = match;
  const protocol = dsn.startsWith("http://") ? "http" : "https";
  return {
    url: `${protocol}://${host}/api/${projectId}/store/`,
    publicKey,
    secretKey: secretKey || publicKey,
  };
}

function dsn(): string | null {
  const value = process.env.SENTRY_DSN?.trim();
  return value ? value : null;
}

function environment(): string {
  return (
    process.env.SENTRY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development"
  );
}

/**
 * Report an error to the configured provider. Fire-and-forget safe: always
 * resolves, never throws, and silently degrades to console logging.
 */
export async function reportError(error: unknown, context: ErrorContext): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));

  // Local log always (structured, greppable)
  console.error(
    `[ERROR] ${context.scope}: ${err.message}`,
    {
      scope: context.scope,
      userId: context.userId ?? undefined,
      workspaceId: context.workspaceId ?? undefined,
      requestId: context.requestId ?? undefined,
      stack: err.stack,
      extra: context.extra,
    },
  );

  const activeDsn = dsn();
  if (!activeDsn) return; // local dev / not configured

  const target = parseDsn(activeDsn);
  if (!target) {
    console.warn("[ERROR] SENTRY_DSN set but could not be parsed; skipping remote report");
    return;
  }

  const event_id = crypto.randomUUID().replace(/-/g, "");
  const payload = {
    event_id,
    timestamp: new Date().toISOString(),
    platform: "node",
    environment: environment(),
    server_name: process.env.VERCEL_REGION || "self-hosted",
    logger: context.scope,
    message: {
      formatted: err.message,
    },
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: [{ filename: "server", function: context.scope, context_line: err.stack.split("\n")[0] }],
              }
            : undefined,
        },
      ],
    },
    tags: {
      scope: context.scope,
      environment: environment(),
    },
    extra: {
      ...context.extra,
      userId: context.userId ?? undefined,
      workspaceId: context.workspaceId ?? undefined,
      requestId: context.requestId ?? undefined,
    },
    release: process.env.SENTRY_RELEASE || undefined,
  };

  const authHeader =
    `Sentry sentry_version=7, sentry_client=komenin/1.0, ` +
    `sentry_key=${target.publicKey}` +
    (target.secretKey ? `, sentry_secret=${target.secretKey}` : "");

  try {
    // Timeout guard so a slow ingest never blocks the caller
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    await fetch(target.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sentry-auth": authHeader,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (sendError) {
    // Never surface reporting failures into the app
    console.warn("[ERROR] Failed to send error report to Sentry:", sendError);
  }
}

/**
 * Wrap a route handler with error reporting. Rethrows after reporting so the
 * platform's own error handling (500 pages, logs) still runs.
 */
export async function withErrorReporting<T>(
  scope: string,
  fn: () => Promise<T>,
  context: Omit<ErrorContext, "scope"> = {},
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await reportError(error, { ...context, scope });
    throw error;
  }
}
