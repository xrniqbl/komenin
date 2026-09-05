"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmTotpEnrollment,
  disableTotp,
  getTotpStatus,
  startTotpEnrollment,
} from "@/server/totp";

type Status = { enabled: boolean; pending: boolean } | null;

export function TotpSettingsCard() {
  const [status, setStatus] = useState<Status>(null);
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await getTotpStatus());
    } catch {
      setStatus({ enabled: false, pending: false });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function start() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setEnrollment(await startTotpEnrollment());
      await load();
    } catch {
      setError("Gagal memulai pendaftaran 2FA.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await confirmTotpEnrollment(code);
      if (!result.ok) {
        setError("Kode belum benar — pastikan jam perangkat akurat dan coba lagi.");
        setBusy(false);
        return;
      }
      setEnrollment(null);
      setCode("");
      setNotice("2FA aktif. Login berikutnya akan diminta kode autentikator.");
      await load();
    } catch {
      setError("Gagal mengaktifkan 2FA.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await disableTotp(code);
      if (!result.ok) {
        setError("Kode salah — 2FA tidak dinonaktifkan.");
        setBusy(false);
        return;
      }
      setCode("");
      setNotice("2FA dinonaktifkan.");
      await load();
    } catch {
      setError("Gagal menonaktifkan 2FA.");
    } finally {
      setBusy(false);
    }
  }

  const enabled = status?.enabled ?? false;
  const showEnroll = !enabled && (enrollment !== null || status?.pending === true);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Dua langkah (TOTP)</CardTitle>
          {status ? (
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? "Aktif" : "Nonaktif"}
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          Kode kedua dari aplikasi autentikator (Google Authenticator, Authy, 1Password).
          Berlaku untuk semua cara login, termasuk Google dan email OTP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? <p className="text-xs text-emerald-600">{notice}</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {enabled ? (
          <form onSubmit={disable} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="totp-disable-code">Kode saat ini untuk menonaktifkan</Label>
              <Input
                id="totp-disable-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button type="submit" variant="outline" disabled={busy || code.length !== 6}>
              {busy ? "Memproses…" : "Nonaktifkan 2FA"}
            </Button>
          </form>
        ) : showEnroll ? (
          <div className="space-y-4">
            {enrollment ? (
              <div className="space-y-2 text-sm">
                <div>
                  <Label>1. Tambahkan ke aplikasi autentikator</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scan URI berikut di aplikasi Anda, atau masukkan kunci manual:
                  </p>
                </div>
                <code className="block break-all rounded-md bg-muted px-2 py-1.5 text-xs">
                  {enrollment.otpauthUri}
                </code>
                <code className="block break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
                  {enrollment.secret}
                </code>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Pendaftaran sebelumnya belum dikonfirmasi. Mulai ulang untuk mendapat kunci baru.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={start} disabled={busy}>
                {enrollment ? "Buat kunci baru" : "Mulai ulang pendaftaran"}
              </Button>
            </div>
            <form onSubmit={confirm} className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="totp-confirm-code">2. Masukkan kode 6 digit</Label>
                <Input
                  id="totp-confirm-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? "Memverifikasi…" : "Aktifkan 2FA"}
              </Button>
            </form>
          </div>
        ) : (
          <Button type="button" onClick={start} disabled={busy || status === null}>
            {busy ? "Memproses…" : "Aktifkan 2FA"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
