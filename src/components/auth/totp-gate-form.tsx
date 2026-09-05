"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyTotpGate } from "@/server/totp";

export function TotpGateForm() {
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
        setError("Kode salah. Coba lagi.");
        setBusy(false);
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch {
      setError("Verifikasi gagal. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verifikasi dua langkah</CardTitle>
        <CardDescription>
          Masukkan kode 6 digit dari aplikasi autentikator Anda untuk melanjutkan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={verify} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="totp-gate-code">Kode autentikator</Label>
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
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? "Memverifikasi…" : "Verifikasi"}
          </Button>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
