"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui-patterns/confirm-action";
import { toastManager } from "@/components/ui/toast";
import { SCOPES } from "@/lib/api-keys";
import { createApiKey, deleteApiKey, revokeApiKey } from "@/server/api-keys";

type Key = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
};

export function ApiKeysManager({ initial }: { initial: Key[] }) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["campaigns:read", "accounts:read", "analytics:read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [lastCreated, setLastCreated] = useState<{ name: string; raw: string } | null>(null);

  const handleCreate = () => {
    if (!name.trim()) { setError("Name required"); return; }
    if (selectedScopes.length === 0) { setError("Select at least one scope"); return; }
    setError("");
    startTransition(async () => {
      try {
        const result = await createApiKey({
          name: name.trim(),
          scopes: selectedScopes,
          expiresAt: expiresAt || null,
        });
        setLastCreated({ name: result.name, raw: (result as unknown as { rawKey: string }).rawKey });
        setName("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create");
      }
    });
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey(id);
      toastManager.add({ title: "API key revoked", type: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
      throw e;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApiKey(id);
      toastManager.add({ title: "API key deleted", type: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      {lastCreated ? (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">API key created — copy now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="text-xs text-muted-foreground">Key <strong>{lastCreated.name}</strong> will not be shown again.</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border bg-background px-3 py-2 font-mono text-xs">{lastCreated.raw}</code>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(lastCreated.raw)}>Copy</Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setLastCreated(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Create API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production read-only" className="h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Expires at (optional)</Label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Scopes</Label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((scope) => (
                <label key={scope} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-accent">
                  <Checkbox
                    checked={selectedScopes.includes(scope)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedScopes((prev) => [...prev, scope]);
                      else setSelectedScopes((prev) => prev.filter((s) => s !== scope));
                    }}
                    className="size-3"
                  />
                  {scope}
                </label>
              ))}
            </div>
          </div>
          <Button size="sm" disabled={pending} onClick={handleCreate}>{pending ? "..." : "Create key"}</Button>
        </CardContent>
      </Card>

      <div className="rounded-2xl border bg-background">
        {initial.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No API keys yet. Create your first above.</div>
        ) : (
          <div className="divide-y">
            {initial.map((k) => (
              <div key={k.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{k.name}</span>
                    <Badge variant={k.isActive ? "secondary" : "outline"} className="text-[10px]">{k.isActive ? "active" : "revoked"}</Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{k.prefix}••••••••</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {k.scopes.map((s) => <Badge key={s} variant="outline" className="text-[9px]">{s}</Badge>)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Created {new Date(k.createdAt).toISOString().slice(0,10)}
                    {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toISOString().slice(0,10)}` : " · Never used"}
                    {k.expiresAt ? ` · Expires ${new Date(k.expiresAt).toISOString().slice(0,10)}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  {k.isActive ? (
                    <ConfirmAction
                      title="Revoke API key?"
                      description="Existing integrations using this key will fail immediately."
                      confirmLabel="Revoke key"
                      destructive
                      disabled={pending}
                      trigger={<Button size="sm" variant="outline">Revoke</Button>}
                      onConfirm={() => handleRevoke(k.id)}
                    />
                  ) : null}
                  <ConfirmAction
                    title="Delete API key?"
                    description="This permanently removes the key and cannot be undone."
                    confirmLabel="Delete key"
                    destructive
                    disabled={pending}
                    trigger={<Button size="sm" variant="ghost">Delete</Button>}
                    onConfirm={() => handleDelete(k.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Usage</div>
        <div className="mt-1">Add header <code className="rounded bg-background px-1">x-api-key: aeth_...</code> or <code className="rounded bg-background px-1">Authorization: Bearer aeth_...</code>. Scopes are enforced per endpoint.</div>
        <div className="mt-2">Endpoints: <code>/api/v1/campaigns</code>, <code>/api/v1/accounts</code>, <code>/api/v1/activity</code>, <code>/api/v1/analytics</code>.</div>
      </div>
    </div>
  );
}
