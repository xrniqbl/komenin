import { NextResponse } from "next/server";
import { createCheckoutSnap } from "@/server/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      planCode?: string;
      voucherCode?: string;
    };
    if (!body.planCode) {
      return NextResponse.json({ error: "planCode required" }, { status: 400 });
    }
    const result = await createCheckoutSnap({
      planCode: body.planCode,
      voucherCode: body.voucherCode,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 400 },
    );
  }
}
