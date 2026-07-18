"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { reimportAccountSession } from "@/server/accounts";
import type { Platform } from "@prisma/client";
import {
  assertProductionSessionPayload,
  hostHintForPlatform,
  loginUrlForPlatform,
  requiredCookieKeys,
} from "@/lib/session-payload";

export function ReimportSessionForm({
  accountId,
  platform,
}: {
  accountId: string;
  platform: Platform;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const required = requiredCookieKeys(platform).join(", ");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      assertProductionSessionPayload(payload, platform);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payload invalid");
      return;
    }

    startTransition(async () => {
      try {
        const result = await reimportAccountSession({
          accountId,
          sessionPayload: payload,
        });
        setMessage(`Session re-imported (${result.cookieCount} cookies).`);
        setPayload("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Re-import failed");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Replace active session with a fresh production cookie payload for {platform}. Required:{" "}
        {required}. Hint: {hostHintForPlatform(platform)}.
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reimportPayload">New session payload (JSON)</Label>
        <Textarea
          id="reimportPayload"
          className="min-h-28 font-mono text-xs"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder='{"platform":"instagram","cookies":[{"name":"sessionid","value":"..."}]}'
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Importing..." : "Re-import session"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => window.open(loginUrlForPlatform(platform), "_blank", "noopener,noreferrer")}
        >
          Buka login {platform}
        </Button>
      </div>
      {error ? (
        <Alert variant="error">
          <AlertTitle>Re-import ditolak</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
