import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  isThreadsOAuthConfigured,
  oauthCallbackUrl,
  verifyOAuthState,
} from "@/lib/oauth-state";
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

  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const shortRes = await fetch(tokenUrl.toString());
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

  const longUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("fb_exchange_token", shortPayload.access_token);
  const longRes = await fetch(longUrl.toString());
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
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=threads&error=${encodeURIComponent(error)}`,
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

  const state = verifyOAuthState(stateRaw);
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
    const message = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=threads&error=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}
