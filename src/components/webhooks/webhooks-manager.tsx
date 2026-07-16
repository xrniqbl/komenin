"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmAction } from "@/components/ui-patterns/confirm-action";
import { toastManager } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createWebhookEndpoint, deleteWebhookEndpoint, testWebhookEndpoint, updateWebhookEndpoint } from "@/server/webhooks";
import { ALL_EVENTS, EVENT_LABELS } from "@/lib/notify/channels";

type Endpoint = {
  id: string;
  name: string;
  url: string;
  actions: string[];
  isActive: boolean;
  createdAt: Date | string;
};

export function WebhooksManager({ initial }: { initial: Endpoint[] }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState("");

  const handleCreate = () => {
    if (!name.trim() || !url.trim()) {
      setError("Name and URL required");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await createWebhookEndpoint({
          name: name.trim(),
          url: url.trim(),
          actions: selectedActions,
          secret: secret.trim() || undefined,
        });
        setName("");
        setUrl("");
        setSecret("");
        setSelectedActions([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create");
      }
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhookEndpoint(id);
      toastManager.add({ title: "Webhook deleted", type: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      throw e;
    }
  };

  const handleToggle = (id: string, active: boolean) => {
    startTransition(async () => {
      try {
        await updateWebhookEndpoint(id, { isActive: !active });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update");
      }
    });
  };

  const handleTest = (id: string) => {
    setTestResult("");
    startTransition(async () => {
      try {
        const res = await testWebhookEndpoint(id);
        setTestResult(`Dispatched to ${res.dispatched} endpoint(s). ${JSON.stringify(res.results)}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Test failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}
      {testResult ? (
        <div className="rounded-xl border bg-muted px-4 py-3 text-xs">{testResult}</div>
      ) : null}

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Add webhook endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Slack #alerts" className="h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Secret (optional Bearer token)</Label>
              <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Optional" className="h-8 text-sm" type="password" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/..." className="h-8 text-sm" />
            <div className="text-[11px] text-muted-foreground">Slack uses https://hooks.slack.com/..., Discord uses https://discord.com/api/webhooks/...</div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Events (leave empty for all)</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((ev) => (
                <label key={ev} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-accent">
                  <Checkbox
                    checked={selectedActions.includes(ev)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedActions((prev) => [...prev, ev]);
                      else setSelectedActions((prev) => prev.filter((x) => x !== ev));
                    }}
                    className="size-3"
                  />
                  {EVENT_LABELS[ev]}
                </label>
              ))}
            </div>
          </div>
          <Button size="sm" disabled={pending} onClick={handleCreate}>
            {pending ? "..." : "Add webhook"}
          </Button>
        </CardContent>
      </Card>

      <div className="rounded-2xl border bg-background">
        {initial.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No webhooks configured. Add your first above.</div>
        ) : (
          <div className="divide-y">
            {initial.map((ep) => (
              <div key={ep.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{ep.name}</span>
                    <Badge variant={ep.isActive ? "secondary" : "outline"} className="text-[10px]">{ep.isActive ? "active" : "inactive"}</Badge>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{ep.url}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ep.actions.length === 0 ? (
                      <Badge variant="outline" className="text-[10px]">All events</Badge>
                    ) : (
                      ep.actions.map((a) => (
                        <Badge key={a} variant="outline" className="text-[9px]">{a}</Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => handleTest(ep.id)}>Test</Button>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={ep.isActive}
                      disabled={pending}
                      onCheckedChange={() => handleToggle(ep.id, ep.isActive)}
                      aria-label={ep.isActive ? "Disable webhook" : "Enable webhook"}
                    />
                    {ep.isActive ? "Active" : "Inactive"}
                  </label>
                  <ConfirmAction
                    title="Delete webhook?"
                    description="This endpoint will stop receiving events immediately."
                    confirmLabel="Delete webhook"
                    destructive
                    disabled={pending}
                    trigger={<Button size="sm" variant="ghost">Delete</Button>}
                    onConfirm={() => handleDelete(ep.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
