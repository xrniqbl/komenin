"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIdr } from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceIdr: number;
  durationMonths: number;
  monthlySendLimit: number;
  monthlyPublishLimit: number;
};

export function CheckoutClient({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [planCode, setPlanCode] = useState(plans[0]?.code || "");
  const [voucherCode, setVoucherCode] = useState("");
  const [discountIdr, setDiscountIdr] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => plans.find((plan) => plan.code === planCode) || plans[0],
    [planCode, plans],
  );

  const total = Math.max((selected?.priceIdr || 0) - discountIdr, 0);

  async function validateVoucher() {
    if (!selected) return;
    setMessage(null);
    const response = await fetch("/api/billing/voucher/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: voucherCode, planCode: selected.code }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setDiscountIdr(0);
      setMessage(payload.error || "Voucher invalid");
      return;
    }
    setDiscountIdr(payload.discountIdr || 0);
    setMessage(`Voucher applied: -${formatIdr(payload.discountIdr || 0)}`);
  }

  async function pay() {
    if (!selected) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/midtrans/snap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planCode: selected.code,
          voucherCode: voucherCode || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Checkout failed");

      if (payload.isSimulation || !payload.clientKey) {
        router.push(`/app/checkout/result?order_id=${encodeURIComponent(payload.orderCode)}&sim=1`);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>("script[data-midtrans-snap]");
        if (existing) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src =
          process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
            ? "https://app.midtrans.com/snap/snap.js"
            : "https://app.sandbox.midtrans.com/snap/snap.js";
        script.setAttribute("data-client-key", payload.clientKey);
        script.setAttribute("data-midtrans-snap", "1");
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Midtrans Snap"));
        document.body.appendChild(script);
      });

      const snap = (window as unknown as { snap?: { pay: (token: string, opts?: object) => void } }).snap;
      if (!snap?.pay) {
        window.location.href = payload.redirectUrl;
        return;
      }

      snap.pay(payload.token, {
        onSuccess: () => {
          router.push(`/app/checkout/result?order_id=${encodeURIComponent(payload.orderCode)}&result=success`);
        },
        onPending: () => {
          router.push(`/app/checkout/result?order_id=${encodeURIComponent(payload.orderCode)}&result=pending`);
        },
        onError: () => {
          router.push(`/app/checkout/result?order_id=${encodeURIComponent(payload.orderCode)}&result=error`);
        },
        onClose: () => setMessage("Snap closed before completion"),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  if (!selected) return <div className="text-sm text-muted-foreground">No plans available.</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-3">
        {plans.map((plan) => (
          <Button
            key={plan.id}
            type="button"
            variant="outline"
            onClick={() => {
              setPlanCode(plan.code);
              setDiscountIdr(0);
              setMessage(null);
            }}
            className={cn(
              "h-auto w-full justify-start rounded-2xl p-4 text-left font-normal whitespace-normal",
              plan.code === selected.code
                ? "border-primary bg-primary/5 hover:bg-primary/5"
                : "hover:bg-muted/30",
            )}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{plan.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{plan.description}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {plan.durationMonths} mo · sends {plan.monthlySendLimit}/mo · publishes {plan.monthlyPublishLimit}/mo
                </div>
              </div>
              <div className="text-right font-semibold">{formatIdr(plan.priceIdr)}</div>
            </div>
          </Button>
        ))}
      </div>

      <Card className="h-fit lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Order summary</CardTitle>
          <CardDescription>Midtrans Snap checkout with optional voucher.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex justify-between"><span>Plan</span><span>{selected.name}</span></div>
          <div className="flex justify-between"><span>Subtotal</span><span>{formatIdr(selected.priceIdr)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-{formatIdr(discountIdr)}</span></div>
          <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatIdr(total)}</span></div>
          <div className="space-y-2">
            <Label htmlFor="voucherCode" className="text-xs text-muted-foreground">Voucher code</Label>
            <div className="flex gap-2">
              <Input
                id="voucherCode"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="flex-1"
                placeholder="AETHER10"
              />
              <Button type="button" variant="outline" onClick={validateVoucher}>Apply</Button>
            </div>
          </div>
          {message ? <div className="rounded-lg bg-muted/40 p-3 text-xs">{message}</div> : null}
          <Button className="w-full" disabled={loading} onClick={pay}>
            {loading ? "Preparing Snap..." : "Pay with Midtrans Snap"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
