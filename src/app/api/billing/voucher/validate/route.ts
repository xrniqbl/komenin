import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { jsonErrorFromUnknown } from "@/lib/api-route";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError } from "@/lib/api-errors";
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
  // Session-cookie authenticated — CSRF guard before voucher probing.
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "api:billing:voucher"),
    limit: 20,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429, undefined, {
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
      },
    });
  }
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return apiError("INVALID_JSON", 400);
    }
    const parsed = voucherSchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(
        "INVALID_INPUT",
        400,
        parsed.error.issues[0]?.message || "code and planCode required",
      );
    }
    const body = parsed.data;
    const plan = await db.plan.findFirst({ where: { code: body.planCode, isActive: true } });
    if (!plan) return apiError("NOT_FOUND", 404, "Plan not found");
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
