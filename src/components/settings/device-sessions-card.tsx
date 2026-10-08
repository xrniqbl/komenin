"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/components/i18n/locale-provider";
import { listLoginDevices, revokeLoginDevice, revokeOtherLoginDevices } from "@/server/login-sessions";
import type { LoginDevice } from "@/server/login-sessions";
import type { Messages } from "@/lib/i18n/messages";

function shortDevice(userAgent: string | null, copy: Messages["auth"]): string {
  if (!userAgent) return copy.devicesUnknown;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : /Firefox\//.test(userAgent)
            ? "Firefox"
            : "Browser";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return [browser, os].filter(Boolean).join(" · ");
}

export function DeviceSessionsCard() {
  const { locale, t } = useLocale();
  const copy = t.auth;
  const [devices, setDevices] = useState<LoginDevice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDevices(await listLoginDevices());
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      await revokeLoginDevice(id);
      await load();
    } catch {
      setError(copy.devicesRevokeFailed);
    } finally {
      setBusy(false);
    }
  }

  async function revokeOthers() {
    setBusy(true);
    setError(null);
    try {
      await revokeOtherLoginDevices();
      await load();
    } catch {
      setError(copy.devicesRevokeOthersFailed);
    } finally {
      setBusy(false);
    }
  }

  const others = (devices ?? []).filter((d) => !d.current).length;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{copy.devicesTitle}</CardTitle>
            <CardDescription>{copy.devicesDescription}</CardDescription>
          </div>
          {others > 0 ? (
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={revokeOthers}
              disabled={busy}
            >
              {copy.devicesRevokeOthers} ({others})
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {devices === null ? (
          <p className="text-sm text-muted-foreground">{copy.devicesLoading}</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {copy.devicesEmpty}
          </p>
        ) : (
          <ul className="divide-y">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{shortDevice(device.userAgent, copy)}</span>
                    {device.current ? <Badge variant="default">{copy.devicesThisDevice}</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {device.ip ? `${device.ip} · ` : ""}
                    {device.provider ? `${device.provider} · ` : ""}
                    {copy.devicesLastActive}{" "}
                    {device.lastSeenAt.toLocaleString(locale === "id" ? "id-ID" : "en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="glass"
                  size="sm"
                  onClick={() => revoke(device.id)}
                  disabled={busy}
                >
                  {copy.devicesRevoke}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
