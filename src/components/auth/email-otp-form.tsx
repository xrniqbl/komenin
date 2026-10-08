"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage = "email" | "code";

export function EmailOtpForm({ callbackUrl = "/onboarding", initialEmail = "" }: { callbackUrl?: string; initialEmail?: string }) {
  const { t } = useLocale();
  const copy = t.auth;
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || copy.sendFailed);
      setStage("code");
      setMessage(
        payload?.devCode
          ? `Mode dev — kode: ${payload.devCode}`
          : copy.codeSent,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signIn("email-otp", {
        email,
        code,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        throw new Error(copy.codeInvalid);
      }
      window.location.href = result?.url || callbackUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.verifyFailed);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {stage === "email" ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="otp-email">{copy.emailLabel}</Label>
            <Input
              id="otp-email"
              type="email"
              required
              autoComplete="email"
              placeholder={copy.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button variant="electric" type="submit" className="w-full" disabled={busy}>
            {busy ? copy.sending : copy.sendCode}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="otp-code">{copy.codeLabel}</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button variant="electric" type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? copy.verifying : copy.signIn}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStage("email");
              setCode("");
              setError(null);
              setMessage(null);
            }}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {copy.changeEmail}
          </button>
        </form>
      )}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
