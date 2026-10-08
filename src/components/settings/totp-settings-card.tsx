"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
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
  const { t } = useLocale();
  const copy = t.auth;
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
      setError(copy.totpEnrollStartFailed);
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
        setError(copy.totpCodeClockHint);
        setBusy(false);
        return;
      }
      setEnrollment(null);
      setCode("");
      setNotice(copy.totpEnabledNotice);
      await load();
    } catch {
      setError(copy.totpEnableFailed);
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
        setError(copy.totpDisableWrong);
        setBusy(false);
        return;
      }
      setCode("");
      setNotice(copy.totpDisabledNotice);
      await load();
    } catch {
      setError(copy.totpDisableFailed);
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
          <CardTitle className="text-base">{copy.securityTitle}</CardTitle>
          {status ? (
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? copy.securityActive : copy.securityInactive}
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          {copy.securityDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? <p className="text-xs text-emerald-600">{notice}</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {enabled ? (
          <form onSubmit={disable} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="totp-disable-code">{copy.totpDisableCodeLabel}</Label>
              <Input
                id="totp-disable-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button type="submit" variant="glass" disabled={busy || code.length !== 6}>
              {busy ? copy.totpProcessing : copy.totpDeactivate}
            </Button>
          </form>
        ) : showEnroll ? (
          <div className="space-y-4">
            {enrollment ? (
              <div className="space-y-2 text-sm">
                <div>
                  <Label>{copy.totpStep1}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.totpStep1Hint}
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
                {copy.totpPendingRestart}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="glass" onClick={start} disabled={busy}>
                {enrollment ? copy.totpNewKey : copy.totpRestart}
              </Button>
            </div>
            <form onSubmit={confirm} className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="totp-confirm-code">{copy.totpStep2}</Label>
                <Input
                  id="totp-confirm-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button variant="electric" type="submit" disabled={busy || code.length !== 6}>
                {busy ? copy.verifying : copy.totpActivate}
              </Button>
            </form>
          </div>
        ) : (
          <Button type="button" onClick={start} disabled={busy || status === null}>
            {busy ? copy.totpProcessing : copy.totpActivate}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
