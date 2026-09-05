"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listLoginDevices, revokeLoginDevice, revokeOtherLoginDevices } from "@/server/login-sessions";
import type { LoginDevice } from "@/server/login-sessions";

function shortDevice(userAgent: string | null): string {
  if (!userAgent) return "Perangkat tidak diketahui";
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
      setError("Gagal mencabut perangkat.");
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
      setError("Gagal mencabut sesi lain.");
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
            <CardTitle className="text-base">Perangkat login</CardTitle>
            <CardDescription>
              Sesi login yang masih aktif. Mencabut sebuah perangkat memaksanya login ulang
              (berlaku dalam ±1 menit).
            </CardDescription>
          </div>
          {others > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={revokeOthers}
              disabled={busy}
            >
              Keluar dari {others} perangkat lain
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {devices === null ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada sesi tercatat — daftar terisi sejak fitur ini aktif.
          </p>
        ) : (
          <ul className="divide-y">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{shortDevice(device.userAgent)}</span>
                    {device.current ? <Badge variant="default">Perangkat ini</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {device.ip ? `${device.ip} · ` : ""}
                    {device.provider ? `${device.provider} · ` : ""}
                    terakhir aktif{" "}
                    {device.lastSeenAt.toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke(device.id)}
                  disabled={busy}
                >
                  Cabut
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
