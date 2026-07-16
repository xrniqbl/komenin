import { NextResponse } from "next/server";
import { validateVoucherCode } from "@/server/billing";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      planCode?: string;
    };
    if (!body.code || !body.planCode) {
      return NextResponse.json({ error: "code and planCode required" }, { status: 400 });
    }
    const plan = await db.plan.findFirst({ where: { code: body.planCode, isActive: true } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    const result = await validateVoucherCode({
      code: body.code,
      planCode: plan.code,
      subtotalIdr: plan.priceIdr,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid voucher" },
      { status: 400 },
    );
  }
}
