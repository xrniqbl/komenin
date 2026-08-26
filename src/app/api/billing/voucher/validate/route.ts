import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { jsonErrorFromUnknown } from "@/lib/api-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateVoucherCode } from "@/server/billing";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const voucherSchema = z.object({
  code: z.string().trim().min(1).max(40),
  planCode: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "api:billing:voucher"),
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
    const parsed = voucherSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "code and planCode required" },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const plan = await db.plan.findFirst({ where: { code: body.planCode, isActive: true } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    const result = await validateVoucherCode({
      code: body.code,
      planCode: plan.code,
      subtotalIdr: plan.priceIdr,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonErrorFromUnknown(error, "Invalid voucher");
  }
}
