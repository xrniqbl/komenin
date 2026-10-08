import type { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth";
import type { ApiScope } from "@/lib/api-keys";
import { apiError } from "@/lib/api-errors";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";

export async function withApiV1(
  req: NextRequest,
  routeKey: string,
  scope: ApiScope,
  opts?: { write?: boolean },
): Promise<
  | { ok: true; workspaceId: string; scopes: string[]; keyId: string }
  | { ok: false; response: NextResponse }
> {
  const rate = await consumeRateLimit({
    key: getRequestRateKey(req, routeKey),
    limit: opts?.write ? 30 : 60,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rate.ok) {
    return {
      ok: false,
      response: apiError("RATE_LIMITED", 429, undefined, {
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": "0",
        },
      }),
    };
  }

  if (opts?.write && !(await isFeatureEnabled(FEATURE_FLAG_KEYS.publicApiWrite))) {
    return {
      ok: false,
      response: apiError(
        "FEATURE_DISABLED",
        403,
        "Public API write is disabled. Enable feature flag `public_api_write` in admin.",
      ),
    };
  }

  const auth = await authenticateApiKey(req);
  if (!auth) {
    return {
      ok: false,
      response: apiError(
        "UNAUTHORIZED",
        401,
        "Unauthorized — provide x-api-key or Authorization: Bearer aeth_...",
      ),
    };
  }

  const scopeCheck = requireScope(auth.scopes, scope);
  if (!scopeCheck.ok) {
    return {
      ok: false,
      response: apiError("SCOPE_REQUIRED", 403, scopeCheck.error),
    };
  }

  return {
    ok: true,
    workspaceId: auth.workspaceId,
    scopes: auth.scopes,
    keyId: auth.keyId,
  };
}
