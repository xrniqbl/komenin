import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth";
import type { ApiScope } from "@/lib/api-keys";
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
  });
  if (!rate.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
            "X-RateLimit-Limit": String(rate.limit),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
    };
  }

  if (opts?.write && !(await isFeatureEnabled(FEATURE_FLAG_KEYS.publicApiWrite))) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Public API write is disabled. Enable feature flag `public_api_write` in admin.",
          code: "FEATURE_DISABLED",
        },
        { status: 403 },
      ),
    };
  }

  const auth = await authenticateApiKey(req);
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Unauthorized — provide x-api-key or Authorization: Bearer aeth_...",
        },
        { status: 401 },
      ),
    };
  }

  const scopeCheck = requireScope(auth.scopes, scope);
  if (!scopeCheck.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: scopeCheck.error }, { status: 403 }),
    };
  }

  return {
    ok: true,
    workspaceId: auth.workspaceId,
    scopes: auth.scopes,
    keyId: auth.keyId,
  };
}
