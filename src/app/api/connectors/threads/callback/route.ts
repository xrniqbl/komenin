import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  isThreadsOAuthConfigured,
  oauthCallbackUrl,
  consumeOAuthState,
  OAUTH_CALLBACK_RATE_LIMIT,
  OAUTH_CALLBACK_WINDOW_MS,
} from "@/lib/oauth-state";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isProductionRuntime } from "@/lib/security";
import { upsertConnectorCredentialFromOAuth } from "@/server/connector-credentials";

export const runtime = "nodejs";

async function exchangeMetaCode(code: string): Promise<{
  accessToken: string;
  expiresIn?: number;
}> {
  const appId = (
    process.env.THREADS_APP_ID?.trim() || process.env.INSTAGRAM_APP_ID?.trim() || ""
  );
  const appSecret = (
    process.env.THREADS_APP_SECRET?.trim() ||
    process.env.INSTAGRAM_APP_SECRET?.trim() ||
    ""
  );
  const redirectUri = oauthCallbackUrl("threads");
  const tokenEndpoint = "https://graph.facebook.com/v21.0/oauth/access_token";

  // POST form-encoded so client_secret and code never appear in query strings.
  const shortRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  const shortPayload = (await shortRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!shortRes.ok || !shortPayload.access_token) {
    throw new Error(
      shortPayload.error?.message || `Threads token exchange failed (${shortRes.status})`,
    );
  }

  const longRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortPayload.access_token,
    }),
  });
  const longPayload = (await longRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (longRes.ok && longPayload.access_token) {
    return {
      accessToken: longPayload.access_token,
      expiresIn: longPayload.expires_in,
    };
  }
  return {
    accessToken: shortPayload.access_token,
    expiresIn: shortPayload.expires_in,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state") || "";

  if (error) {
    // Never reflect the provider's raw error into the redirect URL.
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=threads&error=provider_error`,
        request.url,
      ),
    );
  }

  if (!isThreadsOAuthConfigured()) {
    if (isProductionRuntime()) {
      return NextResponse.json(
        { error: "Threads OAuth is not configured" },
        { status: 501 },
      );
    }
    return NextResponse.redirect(
      new URL(`/app/settings/publisher?oauth=not_configured&provider=threads`, request.url),
    );
  }

  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  // Rate limit: prevent spam to provider API quota
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] ||
                   request.headers.get("cf-connecting-ip") ||
                   "unknown";
  const rateKey = `oauth:threads:${clientIp}`;
  try {
    await consumeRateLimit({
      key: rateKey,
      limit: OAUTH_CALLBACK_RATE_LIMIT,
      windowMs: OAUTH_CALLBACK_WINDOW_MS,
    });
  } catch {
    return NextResponse.json(
      { error: "Too many attempts, please try again later" },
      { status: 429 }
    );
  }

  const state = consumeOAuthState(stateRaw);
  if (!state || state.provider !== "threads") {
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=threads&error=invalid_state`,
        request.url,
      ),
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeMetaCode(code);
    await upsertConnectorCredentialFromOAuth({
      userId: session.user.id,
      workspaceId: state.workspaceId,
      provider: "threads",
      accessToken: tokens.accessToken,
      socialAccountId: state.socialAccountId || null,
      label: "Threads OAuth",
      apiBaseUrl:
        process.env.THREADS_API_BASE_URL?.trim() || "https://graph.threads.net/v1.0",
      scopes: (process.env.THREADS_OAUTH_SCOPES || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      expiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
    });

    return NextResponse.redirect(
      new URL(`/app/settings/publisher?oauth=connected&provider=threads`, request.url),
    );
  } catch (e) {
    console.error("[threads-oauth] token exchange failed", e);
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=threads&error=oauth_failed`,
        request.url,
      ),
    );
  }
}
