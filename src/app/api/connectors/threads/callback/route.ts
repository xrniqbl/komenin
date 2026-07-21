import { NextResponse } from "next/server";
import { isProductionRuntime } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Threads OAuth callback — not implemented yet.
 * Keep fail-closed; do not claim connection success.
 */
export async function GET(request: Request) {
  if (isProductionRuntime()) {
    return NextResponse.json(
      {
        error:
          "threads OAuth callback is not fully implemented. Complete token exchange and encrypted credential storage before production use.",
      },
      { status: 501 },
    );
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=threads&error=${encodeURIComponent(error)}`,
        request.url,
      ),
    );
  }

  return NextResponse.redirect(
    new URL(
      `/app/settings/publisher?oauth=not_implemented&provider=threads`,
      request.url,
    ),
  );
}
