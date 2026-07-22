import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { jsonErrorFromUnknown } from "@/lib/api-route";
import { NextResponse } from "next/server";
import { createCheckoutSnap } from "@/server/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = consumeRateLimit({
    key: getRequestRateKey(request, "api:billing:snap"),
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }
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
    return jsonErrorFromUnknown(error, "Checkout failed");
  }
}
