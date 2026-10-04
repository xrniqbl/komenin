import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createOAuthState,
  instagramOAuthCallbackUrl,
  isInstagramOAuthConfigured,
} from "@/lib/oauth-state";
import { assertWorkspacePermission } from "@/lib/rbac";
import { requireActiveWorkspace } from "@/server/workspace-access";

export const runtime = "nodejs";

/**
 * Start Instagram OAuth (Graph / Facebook Login).
 * Fail-closed until INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET + APP_URL are set.
 * Token exchange lives in the callback route (still partial until vault write is complete).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isInstagramOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Instagram OAuth is not configured. Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and APP_URL.",
        status: "not_configured",
      },
      { status: 503 },
    );
  }

  const { workspace } = await requireActiveWorkspace();
  // L3: reject viewers/operators up front — the callback re-checks
  // settings.manage, but failing early avoids minting signed states for
  // users who can never complete the flow (state-flooding / social
  // engineering surface).
  assertWorkspacePermission(workspace, "settings.manage");
  const { searchParams } = new URL(request.url);
  const socialAccountId = searchParams.get("accountId");

  const state = createOAuthState({
    workspaceId: workspace.id,
    provider: "instagram",
    socialAccountId,
  });

  const appId = process.env.INSTAGRAM_APP_ID!.trim();
  const redirectUri = instagramOAuthCallbackUrl();
  // Instagram Graph typically uses Facebook Login dialog for long-lived page/IG tokens.
  const authorize = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authorize.searchParams.set("client_id", appId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set(
    "scope",
    process.env.INSTAGRAM_OAUTH_SCOPES?.trim() ||
      "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
  );
  authorize.searchParams.set("response_type", "code");

  return NextResponse.redirect(authorize.toString());
}
