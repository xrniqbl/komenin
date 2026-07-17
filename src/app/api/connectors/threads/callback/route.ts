import { NextResponse } from "next/server";
import { isProductionRuntime } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (isProductionRuntime()) {
    return NextResponse.json(
      {
        error: "threads OAuth callback is not fully implemented. Complete token exchange and encrypted credential storage before production use.",
      },
      { status: 501 },
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/app/settings/publisher?oauth=error&provider=threads&error=${encodeURIComponent(error)}`,
        request.url,
      ),
    );
  }
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  // Dev-only placeholder acknowledgment.
  return NextResponse.redirect(
    new URL(`/app/settings/publisher?oauth=threads_connected&stub=1`, request.url),
  );
}