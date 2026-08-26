import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { jsonErrorFromUnknown } from "@/lib/api-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSnap } from "@/server/billing";

export const runtime = "nodejs";

const snapSchema = z.object({
  planCode: z.string().trim().min(1).max(40),
  voucherCode: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const rate = await consumeRateLimit({
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
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = snapSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }
    const result = await createCheckoutSnap({
      planCode: parsed.data.planCode,
      voucherCode: parsed.data.voucherCode,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonErrorFromUnknown(error, "Checkout failed");
  }
}
