import { NextResponse } from "next/server";
import {
  instagramOAuthCallbackUrl,
  isInstagramOAuthConfigured,
  verifyOAuthState,
  OAUTH_CALLBACK_RATE_LIMIT,
  OAUTH_CALLBACK_WINDOW_MS,
} from "@/lib/oauth-state";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isProductionRuntime } from "@/lib/security";
import { upsertConnectorCredentialFromOAuth } from "@/server/connector-credentials";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

async function exchangeInstagramCode(code: string): Promise<{
  accessToken: string;
  expiresIn?: number;
  tokenType?: string;
}> {
  const appId = process.env.INSTAGRAM_APP_ID!.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET!.trim();
  const redirectUri = instagramOAuthCallbackUrl();
  const tokenEndpoint = "https://graph.facebook.com/v21.0/oauth/access_token";

  // Short-lived user token. POST form-encoded so client_secret and code do
  // not end up in query strings (access logs / proxy logs).
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
    token_type?: string;
    error?: { message?: string };
  };
  if (!shortRes.ok || !shortPayload.access_token) {
    throw new Error(
      shortPayload.error?.message || `Token exchange failed (${shortRes.status})`,
    );
  }

  // Prefer long-lived token when possible
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
    token_type?: string;
  };

  if (longRes.ok && longPayload.access_token) {
    return {
      accessToken: longPayload.access_token,
      expiresIn: longPayload.expires_in,
      tokenType: longPayload.token_type,
    };
  }

  return {
    accessToken: shortPayload.access_token,
    expiresIn: shortPayload.expires_in,
    tokenType: shortPayload.token_type,
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
        `/app/settings/publisher?oauth=error&provider=instagram&error=provider_error`,
        request.url,
      ),
    );
  }

  if (!isInstagramOAuthConfigured()) {
    if (isProductionRuntime()) {
      return NextResponse.json(
        {
          error:
            "instagram OAuth callback is not configured. Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, APP_URL.",
        },
        { status: 501 },
      );
    }
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=not_configured&provider=instagram`,
        request.url,
      ),
    );
  }

  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  // Rate limit: prevent spam to provider API quota
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] ||
                   request.headers.get("cf-connecting-ip") ||
                   "unknown";
  const rateKey = `oauth:instagram:${clientIp}`;
  try {
    await consumeRateLimit(rateKey, OAUTH_CALLBACK_RATE_LIMIT, OAUTH_CALLBACK_WINDOW_MS);
  } catch {
    return NextResponse.json(
      { error: "Too many attempts, please try again later" },
      { status: 429 }
    );
  }

  const state = verifyOAuthState(stateRaw);
  if (!state || state.provider !== "instagram") {
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=instagram&error=invalid_state`,
        request.url,
      ),
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeInstagramCode(code);
    await upsertConnectorCredentialFromOAuth({
      userId: session.user.id,
      workspaceId: state.workspaceId,
      provider: "instagram",
      accessToken: tokens.accessToken,
      socialAccountId: state.socialAccountId || null,
      label: "Instagram OAuth",
      apiBaseUrl:
        process.env.INSTAGRAM_GRAPH_BASE_URL?.trim() || "https://graph.facebook.com/v21.0",
      scopes: (process.env.INSTAGRAM_OAUTH_SCOPES || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      expiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
    });

    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=connected&provider=instagram`,
        request.url,
      ),
    );
  } catch (e) {
    // Log the real cause server-side; expose only a generic code to the user
    // so provider/Graph details never land in a redirect URL.
    console.error("[instagram-oauth] token exchange failed", e);
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=instagram&error=oauth_failed`,
        request.url,
      ),
    );
  }
}
