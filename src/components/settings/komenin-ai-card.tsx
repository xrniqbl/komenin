"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatIdr } from "@/lib/billing/catalog";
import { updateAiPreferOwnKey, updateAiPaygFallback } from "@/server/ai-providers";

export type AiPlanOption = {
  code: string;
  name: string;
  description: string | null;
  kind: "ai_subscription" | "ai_credits";
  priceIdr: number;
  aiCredits: string;
};

export type AiBillingStatus = {
  tier: string;
  monthlyCredits: string;
  usedThisPeriod: string;
  remainingThisPeriod: string;
  paygBalance: string;
  preferOwnKey: boolean;
  paygFallbackEnabled: boolean;
  subscriptionStatus: string | null;
  quotaPeriodEnd: Date | null;
};

const TIER_LABEL: Record<string, string> = {
  none: "BYOK (own key)",
  starter: "Komenin AI Starter",
  pro: "Komenin AI Pro",
  pro_max: "Komenin AI Pro Max",
};

function formatCredits(value: string): string {
  return new Intl.NumberFormat("id-ID").format(Number(value));
}

export function KomeninAiCard({
  status,
  aiPlans,
}: {
  status: AiBillingStatus;
  aiPlans: AiPlanOption[];
}) {
  const [preferOwnKey, setPreferOwnKey] = useState(status.preferOwnKey);
  const [paygFallback, setPaygFallback] = useState(status.paygFallbackEnabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const monthly = Number(status.monthlyCredits);
  const used = Number(status.usedThisPeriod);
  const quotaPct = monthly > 0 ? Math.min(100, Math.round((used / monthly) * 100)) : 0;

  const subscriptions = aiPlans.filter((p) => p.kind === "ai_subscription");
  const paygPacks = aiPlans.filter((p) => p.kind === "ai_credits");

  async function togglePreferOwnKey(next: boolean) {
    setPreferOwnKey(next);
    setMessage(null);
    setPending(true);
    try {
      await updateAiPreferOwnKey(next);
      setMessage(
        next
          ? "Workspace will use its own API key first (BYOK)."
          : "Workspace will use Komenin AI credits first.",
      );
    } catch (error) {
      setPreferOwnKey(!next); // revert
      setMessage(error instanceof Error ? error.message : "Failed to save preference");
    } finally {
      setPending(false);
    }
  }

  async function togglePaygFallback(next: boolean) {
    setPaygFallback(next);
    setMessage(null);
    setPending(true);
    try {
      await updateAiPaygFallback(next);
      setMessage(
        next
          ? "When the Pro Max quota runs out, calls automatically continue on your pay-as-you-go balance."
          : "When the quota runs out, AI calls stop (fail-closed).",
      );
    } catch (error) {
      setPaygFallback(!next);
      setMessage(error instanceof Error ? error.message : "Failed to save preference");
    } finally {
      setPending(false);
    }
  }

  async function checkout(planCode: string) {
    setCheckoutLoading(planCode);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/midtrans/snap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const msg =
          typeof payload?.error === "string" && payload.error
            ? payload.error
            : "Checkout failed";
        throw new Error(msg);
      }
      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
        return;
      }
      setMessage("Order created. Complete payment on the checkout page.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setCheckoutLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Komenin AI</CardTitle>
        <CardDescription>
          Use AI without your own API key — subscribe to a monthly quota or buy
          pay-as-you-go credits. 1 credit = 1 token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tier + quota meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{TIER_LABEL[status.tier] ?? status.tier}</span>
            {status.subscriptionStatus ? (
              <span className="text-xs text-muted-foreground">
                status: {status.subscriptionStatus}
              </span>
            ) : null}
          </div>
          {monthly > 0 ? (
            <>
              <Progress value={quotaPct} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Used {formatCredits(status.usedThisPeriod)} / {formatCredits(status.monthlyCredits)} credits this month
                </span>
                <span>{quotaPct}%</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active Komenin AI subscription.
            </p>
          )}
          <div className="text-sm">
            PAYG balance: <span className="font-medium">{formatCredits(status.paygBalance)}</span> credits
          </div>
        </div>

        {/* Prefer own key toggle */}
        <div className="glass flex items-center justify-between rounded-xl p-4">
          <div className="space-y-0.5">
            <Label htmlFor="prefer-own-key" className="text-sm font-medium">
              Prefer own API key (BYOK)
            </Label>
            <p className="text-xs text-muted-foreground">
              When on and you have your own provider, AI calls do not
              consume Komenin credits.
            </p>
          </div>
          <Switch
            id="prefer-own-key"
            checked={preferOwnKey}
            onCheckedChange={togglePreferOwnKey}
            disabled={pending}
          />
        </div>

        {/* Pro Max auto-fallback toggle */}
        {status.tier === "pro_max" ? (
          <div className="glass flex items-center justify-between rounded-xl p-4">
            <div className="space-y-0.5">
              <Label htmlFor="payg-fallback" className="text-sm font-medium">
                Auto-continue to pay-as-you-go
              </Label>
              <p className="text-xs text-muted-foreground">
                Pro Max only: when the monthly quota runs out, AI calls use
                your prepaid credit balance instead of stopping.
              </p>
            </div>
            <Switch
              id="payg-fallback"
              checked={paygFallback}
              onCheckedChange={togglePaygFallback}
              disabled={pending}
            />
          </div>
        ) : null}

        {/* Subscription options */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Monthly subscription</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {subscriptions.map((plan) => (
              <div key={plan.code} className="glass rounded-xl p-4 transition-all hover:border-white/20">
                <div className="text-sm font-medium">{plan.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCredits(plan.aiCredits)} credits/mo
                </div>
                <div className="mt-1 text-sm">{formatIdr(plan.priceIdr)}</div>
                <Button
                  size="sm"
                  variant="glass"
                  className="mt-2 w-full"
                  disabled={checkoutLoading !== null}
                  onClick={() => checkout(plan.code)}
                >
                  {checkoutLoading === plan.code ? "Processing…" : "Choose"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* PAYG packs */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Buy credits (pay-as-you-go)</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {paygPacks.map((plan) => (
              <div key={plan.code} className="glass rounded-xl p-4 transition-all hover:border-white/20">
                <div className="text-sm font-medium">{plan.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCredits(plan.aiCredits)} credits
                </div>
                <div className="mt-1 text-sm">{formatIdr(plan.priceIdr)}</div>
                <Button
                  size="sm"
                  variant="glass"
                  className="mt-2 w-full"
                  disabled={checkoutLoading !== null}
                  onClick={() => checkout(plan.code)}
                >
                  {checkoutLoading === plan.code ? "Processing…" : "Buy"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
