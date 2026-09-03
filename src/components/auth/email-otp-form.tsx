"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage = "email" | "code";

export function EmailOtpForm({ callbackUrl = "/onboarding" }: { callbackUrl?: string }) {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
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
      if (!res.ok) throw new Error(payload?.error || "Gagal mengirim kode.");
      setStage("code");
      setMessage(
        payload?.devCode
          ? `Mode dev — kode: ${payload.devCode}`
          : "Kode 6 digit sudah dikirim ke email Anda.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim kode.");
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
        throw new Error("Kode salah atau kedaluwarsa. Periksa kembali.");
      }
      window.location.href = result?.url || callbackUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifikasi gagal.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {stage === "email" ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="otp-email">Email</Label>
            <Input
              id="otp-email"
              type="email"
              required
              autoComplete="email"
              placeholder="anda@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Mengirim…" : "Kirim kode masuk"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="otp-code">Kode 6 digit</Label>
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
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? "Memverifikasi…" : "Masuk"}
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
            Ganti email / kirim ulang kode
          </button>
        </form>
      )}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
