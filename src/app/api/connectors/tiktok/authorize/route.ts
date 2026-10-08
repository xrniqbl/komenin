import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/api-errors";
import {
  createOAuthState,
  isTikTokOAuthConfigured,
  oauthCallbackUrl,
} from "@/lib/oauth-state";
import { assertWorkspacePermission } from "@/lib/rbac";
import { requireActiveWorkspace } from "@/server/workspace-access";

export const runtime = "nodejs";

/**
 * Start TikTok OAuth (Login Kit / content post authorization).
 * Requires TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET + APP_URL.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isTikTokOAuthConfigured()) {
    return apiError(
      "NOT_CONFIGURED",
      503,
      "TikTok OAuth is not configured. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and APP_URL.",
    );
  }

  let workspace;
  try {
    ({ workspace } = await requireActiveWorkspace());
  } catch {
    return apiError("UNAUTHORIZED", 401, "Authentication required");
  }
  // L3: reject early — the callback re-checks settings.manage, but failing
  // here avoids minting signed states for users who can never complete it.
  try {
    assertWorkspacePermission(workspace, "settings.manage");
  } catch {
    return apiError("FORBIDDEN", 403, "Insufficient permissions");
  }
  const { searchParams } = new URL(request.url);
  const socialAccountId = searchParams.get("accountId");

  const state = createOAuthState({
    workspaceId: workspace.id,
    provider: "tiktok",
    socialAccountId,
  });

  const clientKey = process.env.TIKTOK_CLIENT_KEY!.trim();
  const redirectUri = oauthCallbackUrl("tiktok");
  // TikTok OAuth v2 authorize endpoint
  const authorize = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorize.searchParams.set("client_key", clientKey);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set(
    "scope",
    process.env.TIKTOK_OAUTH_SCOPES?.trim() || "user.info.basic,video.publish,video.upload",
  );

  return NextResponse.redirect(authorize.toString());
}
