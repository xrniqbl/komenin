"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Platform } from "@prisma/client";
import {
  assertProductionSessionPayload,
  buildSessionPayloadFromCookieMap,
  hostHintForPlatform,
  loginUrlForPlatform,
  parseCookieHeader,
  requiredCookieKeys,
  cookieFieldsForPlatform,
} from "@/lib/session-payload";

type ProxyOption = { id: string; label: string };

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "tiktok", label: "TikTok" },
];

function fieldPlaceholder(platform: Platform, key: string, required?: boolean): string {
  if (platform === "tiktok") {
    return key === "sessionid" ? "TikTok sessionid" : `optional ${key}`;
  }
  if (!required) return `optional ${key}`;
  if (key === "sessionid") {
    return platform === "threads" ? "Threads/IG sessionid" : "Instagram sessionid";
  }
  if (key === "ds_user_id") return "user id";
  if (key === "csrftoken") return "csrf token";
  return key;
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function ConnectAccountForm({
  proxies,
  action,
}: {
  proxies: ProxyOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [proxyId, setProxyId] = useState("");
  const [sessionPayload, setSessionPayload] = useState("");
  const [userAgent, setUserAgent] = useState(DEFAULT_UA);
  const [cookieValues, setCookieValues] = useState<Record<string, string>>({});
  const [cookieHeader, setCookieHeader] = useState("");
  const [message, setMessage] = useState<string | null>(
    "Paste cookie session production di raw cookie, lalu Generate payload.",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fields = useMemo(
    () =>
      cookieFieldsForPlatform(platform).map((field) => ({
        ...field,
        placeholder: fieldPlaceholder(platform, field.key, field.required),
      })),
    [platform],
  );
  const requiredLabels = requiredCookieKeys(platform).join(", ");

  const applyPlatform = (next: Platform) => {
    setPlatform(next);
    setCookieValues({});
    setCookieHeader("");
    setSessionPayload("");
    setError(null);
    setMessage(
      next === "instagram"
        ? "Mode Instagram: paste sessionid/ds_user_id/csrftoken production, lalu Generate payload."
        : `Mode ${next}: paste cookie session production, lalu Generate payload.`,
    );
  };

  const generateFromInputs = () => {
    setError(null);
    const fromHeader = parseCookieHeader(cookieHeader);
    const merged = { ...cookieValues, ...fromHeader };
    if (Object.keys(fromHeader).length > 0) {
      setCookieValues((prev) => ({ ...prev, ...fromHeader }));
    }

    const built = buildSessionPayloadFromCookieMap({
      platform,
      values: merged,
      userAgent,
      username,
    });

    try {
      const validated = assertProductionSessionPayload(pretty(built), platform, {
        username,
        userAgent,
      });
      setSessionPayload(pretty(validated.payload));
      setMessage(
        `Session payload ${platform} siap (${validated.cookieNames.length} cookie). Klik Save account.`,
      );
      return true;
    } catch (err) {
      setSessionPayload(pretty(built));
      setError(err instanceof Error ? err.message : "Payload belum valid.");
      return false;
    }
  };

  const pasteClipboard = async () => {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError("Clipboard kosong.");
        return;
      }
      const parsed = parseCookieHeader(text);
      const hasKnown = Object.keys(parsed).some((k) =>
        ["sessionid", "ds_user_id", "csrftoken", "sid_tt", "msToken", "tt_csrf_token"].includes(k),
      );
      if (hasKnown) {
        const merged = { ...cookieValues, ...parsed };
        setCookieValues(merged);
        setCookieHeader(text.trim());
        const built = buildSessionPayloadFromCookieMap({
          platform,
          values: merged,
          userAgent,
          username,
        });
        setSessionPayload(pretty(built));
        setMessage(`Cookie clipboard diparse (${built.cookies.length} cookie).`);
        return;
      }
      try {
        const json = JSON.parse(text);
        setSessionPayload(pretty(json));
        setMessage("JSON session payload dari clipboard dimasukkan.");
      } catch {
        setCookieHeader(text);
        setMessage("Teks clipboard dimasukkan ke raw cookie. Klik Generate payload.");
      }
    } catch {
      setError("Gagal baca clipboard. Tempel manual di kotak raw cookie.");
    }
  };

  const openPlatformLogin = () => {
    window.open(loginUrlForPlatform(platform), "_blank", "noopener,noreferrer");
    setMessage(
      `Login ${platform} di tab baru → ${hostHintForPlatform(platform)} → copy cookie wajib (${requiredLabels}) → paste di raw cookie → Generate payload.`,
    );
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Username wajib diisi.");
      return;
    }

    let payloadText = sessionPayload.trim();
    if (!payloadText) {
      const fromHeader = parseCookieHeader(cookieHeader);
      const merged = { ...cookieValues, ...fromHeader };
      if (Object.keys(merged).some((k) => (merged[k] || "").trim())) {
        const built = buildSessionPayloadFromCookieMap({
          platform,
          values: merged,
          userAgent,
          username,
        });
        payloadText = pretty(built);
        setSessionPayload(payloadText);
      }
    }

    let validatedSerialized = payloadText;
    try {
      const validated = assertProductionSessionPayload(payloadText, platform, {
        username,
        userAgent,
      });
      validatedSerialized = pretty(validated.payload);
      setSessionPayload(validatedSerialized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Session payload invalid.");
      return;
    }

    const formData = new FormData();
    formData.set("platform", platform);
    formData.set("username", username.trim());
    formData.set("displayName", displayName);
    formData.set("proxyId", proxyId);
    formData.set("sessionPayload", validatedSerialized);
    formData.set("userAgent", userAgent);

    startTransition(async () => {
      try {
        await action(formData);
        router.refresh();
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setError(err instanceof Error ? err.message : "Gagal menyimpan account.");
      }
    });
  };

  const proxyOptions = [
    { value: "", label: "Auto-assign later" },
    ...proxies.map((proxy) => ({ value: proxy.id, label: proxy.label })),
  ];

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="platform">Platform</Label>
          <Select
            value={platform}
            onValueChange={(value) => {
              if (typeof value === "string" && value) applyPlatform(value as Platform);
            }}
          >
            <SelectTrigger id="platform" className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {PLATFORM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <input type="hidden" name="platform" value={platform} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            required
            placeholder="brand.official"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="proxyId">Proxy (optional)</Label>
        <Select
          value={proxyId}
          onValueChange={(value) => setProxyId(typeof value === "string" ? value : "")}
        >
          <SelectTrigger id="proxyId" className="w-full min-w-0">
            <SelectValue placeholder="Auto-assign later" />
          </SelectTrigger>
          <SelectPopup>
            {proxyOptions.map((option) => (
              <SelectItem key={option.value || "__empty"} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <input type="hidden" name="proxyId" value={proxyId} />
      </div>

      <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">Import session production</div>
            <Badge variant="secondary">{platform}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Production mode: paste cookie session asli. Browser tidak bisa auto-baca cookie domain platform.
          </p>
        </div>

        <Alert>
          <AlertTitle>Cara ambil session {platform}</AlertTitle>
          <AlertDescription className="space-y-1 text-xs">
            <div>
              1. Klik <em>Buka login {platform}</em> dan login sampai sukses.
            </div>
            <div>2. {hostHintForPlatform(platform)}</div>
            <div>3. Copy cookie wajib: {requiredLabels}</div>
            <div>4. Paste di raw cookie → Generate payload → Save account</div>
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={generateFromInputs}>
            Generate payload dari cookie
          </Button>
          <Button type="button" variant="outline" onClick={openPlatformLogin}>
            Buka login {platform}
          </Button>
          <Button type="button" variant="ghost" onClick={pasteClipboard}>
            Tempel clipboard
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cookieHeader">Paste raw cookie di sini</Label>
          <Textarea
            id="cookieHeader"
            value={cookieHeader}
            onChange={(e) => setCookieHeader(e.target.value)}
            className="min-h-28 font-mono text-xs"
            placeholder={
              platform === "tiktok"
                ? "sessionid=...; sid_tt=...; msToken=..."
                : "sessionid=...; ds_user_id=...; csrftoken=..."
            }
          />
          <p className="text-[11px] text-muted-foreground">
            Contoh Instagram: <code>sessionid=abc; ds_user_id=123; csrftoken=xyz</code>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`cookie-${field.key}`} className="text-xs">
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              <Input
                id={`cookie-${field.key}`}
                value={cookieValues[field.key] || ""}
                placeholder={field.placeholder}
                onChange={(e) =>
                  setCookieValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                autoComplete="off"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="userAgent" className="text-xs">
            User-Agent
          </Label>
          <Input
            id="userAgent"
            name="userAgent"
            value={userAgent}
            onChange={(e) => setUserAgent(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="sessionPayload">Session payload (JSON)</Label>
          <Button type="button" size="sm" variant="outline" onClick={generateFromInputs}>
            Generate payload
          </Button>
        </div>
        <Textarea
          id="sessionPayload"
          name="sessionPayload"
          className="min-h-40 font-mono text-xs"
          placeholder='Paste cookie production lalu klik "Generate payload". Jangan save jika cookies: []'
          value={sessionPayload}
          onChange={(e) => setSessionPayload(e.target.value)}
        />
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>

      {error ? (
        <Alert variant="error">
          <AlertTitle>Belum bisa lanjut</AlertTitle>
          <AlertDescription className="space-y-2 text-xs">
            <div>{error}</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={openPlatformLogin}>
                Buka login {platform}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={pasteClipboard}>
                Tempel clipboard
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving..." : "Save account"}
      </Button>
    </form>
  );
}
