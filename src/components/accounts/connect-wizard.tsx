"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Platform } from "@prisma/client";
import {
  formatLabel,
  missingRequiredKeys,
  parseAnyCookieFormat,
} from "@/lib/connectors/session-parse";
import { cookieFieldsForPlatform, loginUrlForPlatform, requiredCookieKeys } from "@/lib/session-payload";
import {
  claimSessionIngest,
  getSessionIngestStatus,
  mintSessionIngestToken,
} from "@/server/session-ingest";

type ProxyOption = { id: string; label: string };
type IngestState = "idle" | "waiting" | "ready" | "claimed" | "expired";

const POLL_MS = 2_500;
const STEP_LABELS = ["Pilih platform", "Ambil akses", "Selesai"] as const;

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function StepDot({ index, active, done }: { index: number; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
          done
            ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40"
            : active
              ? "bg-[var(--accent)] text-white"
              : "bg-white/[0.05] text-muted-foreground",
        ].join(" ")}
        aria-hidden="true"
      >
        {done ? "✓" : index + 1}
      </span>
      <span
        className={[
          "text-xs",
          active ? "font-medium text-foreground" : "text-muted-foreground",
        ].join(" ")}
      >
        {STEP_LABELS[index]}
      </span>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {STEP_LABELS.map((_, index) => (
        <li key={index} className="flex items-center gap-5">
          <StepDot index={index} active={step === index} done={step > index} />
          {index < STEP_LABELS.length - 1 ? (
            <span className="hidden h-px w-8 bg-white/10 sm:block" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function ConnectWizard({
  proxies,
  action,
  appOrigin,
}: {
  proxies: ProxyOption[];
  action: (formData: FormData) => void | Promise<void>;
  appOrigin: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [mode, setMode] = useState<"extension" | "paste">("extension");

  const [token, setToken] = useState("");
  const [tokenNotice, setTokenNotice] = useState<string | null>(null);
  const [ingest, setIngest] = useState<IngestState>("idle");
  const [ingestNote, setIngestNote] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [raw, setRaw] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [proxyId, setProxyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ accountId?: string; message: string } | null>(null);

  const required = useMemo(() => requiredCookieKeys(platform), [platform]);
  const fields = useMemo(() => cookieFieldsForPlatform(platform), [platform]);

  const parsed = useMemo(() => parseAnyCookieFormat(raw), [raw]);
  const missing = useMemo(() => missingRequiredKeys(parsed.cookies, required), [parsed, required]);
  const pasteReady = missing.length === 0 && parsed.keys.length > 0;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // Poll the ingest slot while the extension path is armed.
  useEffect(() => {
    if (step !== 1 || mode !== "extension" || !token || ingest === "claimed") return;
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const status = await getSessionIngestStatus(token);
        if (status.state === "ready") {
          setIngest("ready");
          setIngestNote(`Cookie diterima (${status.cookieCount} item). Lanjut ke langkah terakhir.`);
          stopPolling();
          setStep(2);
        } else if (status.state === "claimed") {
          setIngest("claimed");
          stopPolling();
        } else if (status.state === "expired") {
          setIngest("expired");
          setIngestNote("Token kedaluwarsa. Buat token baru.");
          stopPolling();
        } else {
          setIngest("waiting");
        }
      } catch {
        // Server unreachable — keep polling; the interval is cheap.
      }
    }, POLL_MS);
    return stopPolling;
  }, [step, mode, token, ingest, stopPolling]);

  const resetForPlatform = (next: Platform) => {
    setPlatform(next);
    setToken("");
    setTokenNotice(null);
    setIngest("idle");
    setIngestNote(null);
    setRaw("");
    setError(null);
    setNotice(null);
    setDone(null);
    setUsername("");
  };

  const mintToken = async () => {
    setError(null);
    setPending(true);
    try {
      const result = await mintSessionIngestToken(platform as "instagram" | "threads" | "tiktok");
      setToken(result.token);
      setTokenNotice(`Token aktif ${result.expiresInMinutes} menit. Salin ke ekstensi, lalu klik Sambungkan di tab Instagram.`);
      setIngest("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat token.");
    } finally {
      setPending(false);
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setNotice("Token tersalin ke clipboard.");
    } catch {
      setNotice("Salin manual dari kotak token di bawah.");
    }
  };

  const goManual = () => {
    setMode("paste");
    stopPolling();
    setIngest("idle");
  };

  const goExtension = () => {
    setMode("extension");
    setError(null);
  };

  const manualNext = () => {
    setError(null);
    if (!pasteReady) {
      setError(
        parsed.keys.length === 0
          ? "Belum ada cookie terbaca. Tempel dulu hasil salinan dari browser."
          : `Cookie belum lengkap. Masih kurang: ${missing.join(", ")}.`,
      );
      return;
    }
    if (!username.trim()) {
      // Username is shown on most platforms; let the user confirm it next step.
      setNotice("Isi username di langkah terakhir sebelum menyimpan.");
    }
    setStep(2);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError("Username wajib diisi.");
      return;
    }

    setPending(true);
    try {
      if (mode === "extension") {
        const result = await claimSessionIngest(token, {
          username: username.trim(),
          displayName: displayName.trim() || undefined,
          proxyEndpointId: proxyId || undefined,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setDone({ accountId: result.accountId, message: result.message });
        router.refresh();
        return;
      }

      // Manual path: build the payload locally and hand it to createAccount.
      const payload = {
        platform,
        username: username.trim().replace(/^@/, ""),
        ua: navigator.userAgent,
        capturedAt: new Date().toISOString(),
        cookies: Object.entries(parsed.cookies).map(([name, value]) => ({
          name,
          value,
          path: "/",
          secure: true,
        })),
        meta: { source: "wizard_manual_import", cookieCount: parsed.keys.length },
      };

      const formData = new FormData();
      formData.set("platform", platform);
      formData.set("username", username.trim());
      formData.set("displayName", displayName);
      formData.set("proxyId", proxyId);
      formData.set("sessionPayload", JSON.stringify(payload, null, 2));
      formData.set("userAgent", navigator.userAgent);
      await action(formData);
      router.refresh();
    } catch (err) {
      if (isNextRedirectError(err)) throw err;
      setError(err instanceof Error ? err.message : "Gagal menyimpan akun.");
    } finally {
      setPending(false);
    }
  };

  const proxyOptions = [
    { value: "", label: "Auto-assign nanti" },
    ...proxies.map((p) => ({ value: p.id, label: p.label })),
  ];

  if (done) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Tersambung</CardTitle>
          <CardDescription>{done.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button render={<Link href="/app/accounts" />} nativeButton={false} variant="electric">
            Lihat daftar akun
          </Button>
          <Button
            variant="glass"
            onClick={() => {
              setDone(null);
              setStep(0);
              setToken("");
              setRaw("");
              setUsername("");
              setDisplayName("");
              setIngest("idle");
            }}
          >
            Sambungkan akun lain
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Stepper step={step} />

      {error ? (
        <Alert variant="error">
          <AlertTitle>Belum bisa lanjut</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : notice ? (
        <Alert>
          <AlertTitle>Catatan</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {/* Step 1 — platform */}
      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mau menyambungkan mana?</CardTitle>
            <CardDescription>
              Pilih satu. Anda bisa menambah akun lain kapan saja setelah ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(["instagram", "threads"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  resetForPlatform(id as Platform);
                  setPlatform(id as Platform);
                  setStep(1);
                }}
                className={[
                  "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                  platform === id
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25",
                ].join(" ")}
              >
                <span className="text-sm font-semibold capitalize">{id}</span>
                <span className="text-xs text-muted-foreground">
                  {id === "instagram"
                    ? "Posting, komentar, dan hashtag di instagram.com"
                    : "Posting dan balasan di threads.net"}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Step 2 — get access */}
      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Ambil akses {platform === "instagram" ? "Instagram" : "Threads"}
            </CardTitle>
            <CardDescription>
              Dua cara. Cara pertama jauh lebih mudah dan hanya perlu sekali setel.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "extension" ? "electric" : "glass"}
                onClick={goExtension}
              >
                1. Ekstensi (mudah)
              </Button>
              <Button
                type="button"
                variant={mode === "paste" ? "electric" : "glass"}
                onClick={goManual}
              >
                2. Tempel manual
              </Button>
            </div>

            {mode === "extension" ? (
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <ol className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">1.</span> Unduh folder{" "}
                    <code className="rounded bg-white/10 px-1">extensions/komenin-connect</code>{" "}
                    dari repo, lalu buka <code className="rounded bg-white/10 px-1">chrome://extensions</code>{" "}
                    dan aktifkan <em>Developer mode</em> → <em>Load unpacked</em>.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">2.</span> Login di{" "}
                    <a
                      className="underline"
                      href={loginUrlForPlatform(platform)}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {platform}.com
                    </a>{" "}
                    lalu klik tombol <em>Sambungkan</em> di ekstensi.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">3.</span> Balik ke sini — halaman
                    ini otomatis mendeteksi dan lanjut sendiri.
                  </li>
                </ol>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="electric" onClick={mintToken} disabled={pending}>
                    {token ? "Buat token baru" : "Buat token"}
                  </Button>
                  {token ? (
                    <Button type="button" variant="glass" onClick={copyToken}>
                      Salin token
                    </Button>
                  ) : null}
                </div>

                {token ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="token-box" className="text-xs">
                      Token (tempel di ekstensi)
                    </Label>
                    <Input
                      id="token-box"
                      readOnly
                      value={token}
                      onFocus={(e) => e.currentTarget.select()}
                      className="font-mono text-[11px]"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Alamat server di ekstensi:{" "}
                      <code className="rounded bg-white/10 px-1">{appOrigin}</code>
                    </p>
                  </div>
                ) : null}

                {tokenNotice ? (
                  <p className="text-xs text-muted-foreground">{tokenNotice}</p>
                ) : null}

                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={[
                      "h-2 w-2 rounded-full",
                      ingest === "ready"
                        ? "bg-emerald-500"
                        : ingest === "waiting"
                          ? "animate-pulse bg-amber-400"
                          : ingest === "expired"
                            ? "bg-red-500"
                            : "bg-white/20",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {ingest === "waiting"
                      ? "Menunggu ekstensi mengirim cookie…"
                      : ingest === "ready"
                        ? "Cookie diterima."
                        : ingest === "expired"
                          ? "Token kedaluwarsa."
                          : "Belum ada token."}
                  </span>
                </div>
                {ingestNote ? <p className="text-xs text-muted-foreground">{ingestNote}</p> : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="glass"
                    onClick={() =>
                      window.open(loginUrlForPlatform(platform), "_blank", "noopener,noreferrer")
                    }
                  >
                    Buka {platform}
                  </Button>
                  <Button
                    type="button"
                    variant="glass"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (!text.trim()) {
                          setError("Clipboard kosong.");
                          return;
                        }
                        setRaw(text.trim());
                        setError(null);
                      } catch {
                        setError("Browser menolak membaca clipboard — tempel manual.");
                      }
                    }}
                  >
                    Tempel dari clipboard
                  </Button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cookie-raw" className="text-xs">
                    Tempel apa saja: header cookie, JSON, perintah cURL, atau daftar nama=nilai
                  </Label>
                  <textarea
                    id="cookie-raw"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    rows={5}
                    spellCheck={false}
                    className="w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder={
                      platform === "tiktok"
                        ? "sessionid=…; sid_tt=…; msToken=…"
                        : "sessionid=…; ds_user_id=…; csrftoken=…"
                    }
                  />
                </div>

                {parsed.keys.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{formatLabel(parsed.format)}</Badge>
                      <Badge variant="secondary">{parsed.keys.length} cookie terbaca</Badge>
                      {missing.length === 0 ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400">Lengkap</Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-400">
                          Kurang {missing.length}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fields.map((f) => (
                        <Badge
                          key={f.key}
                          variant="secondary"
                          className={
                            parsed.cookies[f.key]
                              ? "bg-emerald-500/10 text-emerald-400"
                              : f.required
                                ? "bg-red-500/10 text-red-400"
                                : "opacity-50"
                          }
                        >
                          {f.label}
                          {f.required ? " *" : ""}
                        </Badge>
                      ))}
                    </div>
                    {missing.length > 0 ? (
                      <p className="text-[11px] text-amber-400">
                        Masih kurang: {missing.join(", ")} — salin ulang dari browser.
                      </p>
                    ) : null}
                  </div>
                ) : raw.trim() ? (
                  <p className="text-[11px] text-red-400">
                    Belum ada cookie yang terbaca dari teks ini.
                  </p>
                ) : null}

                <div>
                  <Button type="button" variant="electric" onClick={manualNext} disabled={!pasteReady}>
                    Lanjut
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button type="button" variant="glass" onClick={() => setStep(0)}>
                Kembali
              </Button>
              {mode === "extension" && ingest === "ready" ? (
                <Button type="button" variant="electric" onClick={() => setStep(2)}>
                  Lanjut
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 3 — save */}
      {step === 2 ? (
        <form onSubmit={onSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Konfirmasi &amp; simpan</CardTitle>
              <CardDescription>
                Periksa username, lalu klik Sambungkan. Sesi disimpan terenkripsi.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wiz-username">Username</Label>
                  <Input
                    id="wiz-username"
                    required
                    autoComplete="off"
                    placeholder={platform === "instagram" ? "brand.official" : "brand"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wiz-display">Nama tampilan (opsional)</Label>
                  <Input
                    id="wiz-display"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="wiz-proxy">Proxy (opsional)</Label>
                <Select
                  value={proxyId}
                  onValueChange={(v) => setProxyId(typeof v === "string" ? v : "")}
                >
                  <SelectTrigger id="wiz-proxy" className="w-full min-w-0">
                    <SelectValue placeholder="Auto-assign nanti" />
                  </SelectTrigger>
                  <SelectPopup>
                    {proxyOptions.map((o) => (
                      <SelectItem key={o.value || "__empty"} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {platform}
                  </Badge>
                  <span>
                    {mode === "extension"
                      ? `${parsed.keys.length || "cookie"} dari ekstensi`
                      : `${parsed.keys.length} cookie ditempel manual`}
                  </span>
                </div>
                <p className="mt-2">
                  Jalur tidak resmi (cookie sesi). Post akan langsung dikirim ke {platform}, tanpa
                  menunggu persetujuan Meta.
                </p>
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="glass"
                  onClick={() => setStep(1)}
                  disabled={pending}
                >
                  Kembali
                </Button>
                <Button type="submit" variant="electric" disabled={pending}>
                  {pending ? "Menyambungkan…" : "Sambungkan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      ) : null}
    </div>
  );
}
