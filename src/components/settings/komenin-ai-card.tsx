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
  none: "BYOK (key sendiri)",
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
          ? "Workspace akan memakai API key sendiri dulu (BYOK)."
          : "Workspace akan memakai kredit Komenin AI dulu.",
      );
    } catch (error) {
      setPreferOwnKey(!next); // revert
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan preferensi");
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
          ? "Saat kuota Pro Max habis, panggilan otomatis lanjut ke saldo pay-as-you-go."
          : "Saat kuota habis, pemanggilan AI berhenti (fail-closed).",
      );
    } catch (error) {
      setPaygFallback(!next);
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan preferensi");
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
            : "Checkout gagal";
        throw new Error(msg);
      }
      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
        return;
      }
      setMessage("Order dibuat. Selesaikan pembayaran di halaman checkout.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout gagal");
    } finally {
      setCheckoutLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Komenin AI</CardTitle>
        <CardDescription>
          Pakai AI tanpa API key sendiri — berlangganan kuota bulanan atau beli
          kredit pay-as-you-go. 1 kredit = 1 token.
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
                  Terpakai {formatCredits(status.usedThisPeriod)} / {formatCredits(status.monthlyCredits)} kredit bulan ini
                </span>
                <span>{quotaPct}%</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada langganan Komenin AI aktif.
            </p>
          )}
          <div className="text-sm">
            Saldo PAYG: <span className="font-medium">{formatCredits(status.paygBalance)}</span> kredit
          </div>
        </div>

        {/* Prefer own key toggle */}
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="prefer-own-key" className="text-sm font-medium">
              Utamakan API key sendiri (BYOK)
            </Label>
            <p className="text-xs text-muted-foreground">
              Jika aktif dan Anda punya provider sendiri, panggilan AI tidak
              memotong kredit Komenin.
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
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="payg-fallback" className="text-sm font-medium">
                Lanjut otomatis ke pay-as-you-go
              </Label>
              <p className="text-xs text-muted-foreground">
                Khusus Pro Max: saat kuota bulanan habis, panggilan AI memakai
                saldo kredit prabayar alih-alih berhenti.
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
          <div className="text-sm font-medium">Langganan bulanan</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {subscriptions.map((plan) => (
              <div key={plan.code} className="rounded-md border p-3">
                <div className="text-sm font-medium">{plan.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCredits(plan.aiCredits)} kredit/bln
                </div>
                <div className="mt-1 text-sm">{formatIdr(plan.priceIdr)}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  disabled={checkoutLoading !== null}
                  onClick={() => checkout(plan.code)}
                >
                  {checkoutLoading === plan.code ? "Memproses…" : "Pilih"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* PAYG packs */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Beli kredit (pay-as-you-go)</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {paygPacks.map((plan) => (
              <div key={plan.code} className="rounded-md border p-3">
                <div className="text-sm font-medium">{plan.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCredits(plan.aiCredits)} kredit
                </div>
                <div className="mt-1 text-sm">{formatIdr(plan.priceIdr)}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  disabled={checkoutLoading !== null}
                  onClick={() => checkout(plan.code)}
                >
                  {checkoutLoading === plan.code ? "Memproses…" : "Beli"}
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
