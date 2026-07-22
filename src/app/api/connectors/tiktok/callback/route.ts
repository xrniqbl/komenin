import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  isTikTokOAuthConfigured,
  oauthCallbackUrl,
  verifyOAuthState,
} from "@/lib/oauth-state";
import { isProductionRuntime } from "@/lib/security";
import { upsertConnectorCredentialFromOAuth } from "@/server/connector-credentials";

export const runtime = "nodejs";

async function exchangeTikTokCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  openId?: string;
}> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY!.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET!.trim();
  const redirectUri = oauthCallbackUrl("tiktok");

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    error?: string;
    error_description?: string;
    message?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        payload.message ||
        `TikTok token exchange failed (${response.status})`,
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    openId: payload.open_id,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error") || searchParams.get("error_description");
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state") || "";

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=tiktok&error=${encodeURIComponent(error)}`,
        request.url,
      ),
    );
  }

  if (!isTikTokOAuthConfigured()) {
    if (isProductionRuntime()) {
      return NextResponse.json(
        { error: "TikTok OAuth is not configured" },
        { status: 501 },
      );
    }
    return NextResponse.redirect(
      new URL(`/app/settings/publisher?oauth=not_configured&provider=tiktok`, request.url),
    );
  }

  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const state = verifyOAuthState(stateRaw);
  if (!state || state.provider !== "tiktok") {
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=tiktok&error=invalid_state`,
        request.url,
      ),
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeTikTokCode(code);
    await upsertConnectorCredentialFromOAuth({
      userId: session.user.id,
      workspaceId: state.workspaceId,
      provider: "tiktok",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || null,
      socialAccountId: state.socialAccountId || null,
      label: tokens.openId ? `TikTok ${tokens.openId.slice(0, 8)}` : "TikTok OAuth",
      apiBaseUrl:
        process.env.TIKTOK_API_BASE_URL?.trim() || "https://open.tiktokapis.com",
      scopes: (process.env.TIKTOK_OAUTH_SCOPES || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      expiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
    });

    return NextResponse.redirect(
      new URL(`/app/settings/publisher?oauth=connected&provider=tiktok`, request.url),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=tiktok&error=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}
