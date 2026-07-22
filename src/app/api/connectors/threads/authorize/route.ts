import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createOAuthState,
  isThreadsOAuthConfigured,
  oauthCallbackUrl,
} from "@/lib/oauth-state";
import { requireActiveWorkspace } from "@/server/workspace-access";

export const runtime = "nodejs";

/**
 * Start Threads OAuth via Meta Facebook Login dialog.
 * Requires THREADS_APP_ID/SECRET (or falls back to INSTAGRAM_APP_*).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isThreadsOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Threads OAuth is not configured. Set THREADS_APP_ID + THREADS_APP_SECRET (or INSTAGRAM_APP_*) and APP_URL.",
        status: "not_configured",
      },
      { status: 503 },
    );
  }

  const { workspace } = await requireActiveWorkspace();
  const { searchParams } = new URL(request.url);
  const socialAccountId = searchParams.get("accountId");

  const state = createOAuthState({
    workspaceId: workspace.id,
    provider: "threads",
    socialAccountId,
  });

  const appId = (
    process.env.THREADS_APP_ID?.trim() || process.env.INSTAGRAM_APP_ID?.trim() || ""
  );
  const redirectUri = oauthCallbackUrl("threads");
  const authorize = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authorize.searchParams.set("client_id", appId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set(
    "scope",
    process.env.THREADS_OAUTH_SCOPES?.trim() ||
      "threads_basic,threads_content_publish",
  );
  authorize.searchParams.set("response_type", "code");

  return NextResponse.redirect(authorize.toString());
}
