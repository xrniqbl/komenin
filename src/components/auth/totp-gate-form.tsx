"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/components/i18n/locale-provider";
import { verifyTotpGate } from "@/server/totp";

export function TotpGateForm() {
  const { t } = useLocale();
  const copy = t.auth;
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await verifyTotpGate(code);
      if (!result.ok) {
        setError(copy.totpWrong);
        setBusy(false);
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch {
      setError(copy.totpVerifyFailed);
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.totpTitle}</CardTitle>
        <CardDescription>
          {copy.totpDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={verify} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="totp-gate-code">{copy.totpLabel}</Label>
            <Input
              id="totp-gate-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="••••••"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button variant="electric" type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? copy.verifying : copy.totpVerify}
          </Button>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
