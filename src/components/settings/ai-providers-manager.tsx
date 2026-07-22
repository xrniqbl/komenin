"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspaceAiProvider,
  deleteWorkspaceAiProvider,
  testWorkspaceAiProvider,
  updateWorkspaceAiDefaults,
  updateWorkspaceAiProvider,
  type WorkspaceAiProviderSummary,
} from "@/server/ai-providers";

type Defaults = {
  defaultProviderId: string | null;
  defaultModel: string | null;
  fallbackModels: string[];
  temperature: number;
  maxTokens: number;
};

type EnvBootstrap = {
  enabled: boolean;
  providerCount: number;
  providers: Array<{
    id: string;
    baseUrl: string;
    models: string[];
    hasApiKey: boolean;
  }>;
};

const KIND_OPTIONS = [
  { value: "ninerouter", label: "9Router (OpenAI-compatible gateway)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai_compatible", label: "Custom OpenAI-compatible" },
];

function parseModels(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function AiProvidersManager({
  initialProviders,
  initialDefaults,
  envBootstrap,
}: {
  initialProviders: WorkspaceAiProviderSummary[];
  initialDefaults: Defaults;
  envBootstrap: EnvBootstrap;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [kind, setKind] = useState("openai");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState("gpt-4o-mini");

  const [defaultProviderId, setDefaultProviderId] = useState(
    initialDefaults.defaultProviderId || "",
  );
  const [defaultModel, setDefaultModel] = useState(initialDefaults.defaultModel || "");
  const [fallbackModels, setFallbackModels] = useState(
    (initialDefaults.fallbackModels || []).join(", "),
  );
  const [temperature, setTemperature] = useState(String(initialDefaults.temperature ?? 0.5));
  const [maxTokens, setMaxTokens] = useState(String(initialDefaults.maxTokens ?? 280));

  const modelHints = useMemo(() => {
    const set = new Set<string>();
    for (const p of initialProviders) for (const m of p.models) set.add(m);
    for (const p of envBootstrap.providers) for (const m of p.models) set.add(m);
    return Array.from(set);
  }, [initialProviders, envBootstrap.providers]);

  const refresh = () => router.refresh();

  const onCreate = () => {
    setError("");
    setInfo("");
    startTransition(async () => {
      try {
        await createWorkspaceAiProvider({
          kind,
          label: label || kind,
          baseUrl: baseUrl || null,
          apiKey: apiKey || null,
          models: parseModels(models),
          isEnabled: true,
          priority: 100,
        });
        setLabel("");
        setApiKey("");
        setInfo("Provider added");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create provider");
      }
    });
  };

  const onSaveDefaults = () => {
    setError("");
    setInfo("");
    startTransition(async () => {
      try {
        await updateWorkspaceAiDefaults({
          defaultProviderId: defaultProviderId || null,
          defaultModel: defaultModel || null,
          fallbackModels: parseModels(fallbackModels),
          temperature: Number(temperature),
          maxTokens: Number(maxTokens),
        });
        setInfo("Workspace AI defaults saved");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save defaults");
      }
    });
  };

  const onTest = (providerId?: string) => {
    setError("");
    setInfo("");
    startTransition(async () => {
      try {
        const result = await testWorkspaceAiProvider({
          providerId: providerId || defaultProviderId || null,
          model: defaultModel || null,
        });
        if (!result.ok) {
          setError(result.error || "Test failed");
          return;
        }
        setInfo(`OK via ${result.providerId} / ${result.model}: ${result.sample}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Test failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="error">
          <AlertTitle>AI settings error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {info ? (
        <Alert variant="info">
          <AlertTitle>AI settings</AlertTitle>
          <AlertDescription className="font-mono text-xs">{info}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace defaults</CardTitle>
          <CardDescription>
            Used by comment bots when an agent does not override provider/model. Env 9Router remains
            a platform bootstrap if no workspace providers exist.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="defaultProviderId">Default provider</Label>
            <select
              id="defaultProviderId"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={defaultProviderId}
              onChange={(e) => setDefaultProviderId(e.target.value)}
            >
              <option value="">(auto / env bootstrap)</option>
              {initialProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.kind})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="defaultModel">Default model</Label>
            <Input
              id="defaultModel"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder={modelHints[0] || "gpt-4o-mini / claude-sonnet-4-6"}
              list="ai-model-hints"
            />
            <datalist id="ai-model-hints">
              {modelHints.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="fallbackModels">Fallback models (comma-separated)</Label>
            <Input
              id="fallbackModels"
              value={fallbackModels}
              onChange={(e) => setFallbackModels(e.target.value)}
              placeholder="gpt-4o-mini, claude-haiku-4-5"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxTokens">Max tokens</Label>
            <Input id="maxTokens" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="button" disabled={pending} onClick={onSaveDefaults}>
              Save defaults
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onTest()}>
              Test routing
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add provider</CardTitle>
          <CardDescription>
            API keys are encrypted at rest and never shown again after save. OpenAI/Anthropic require
            a key; 9Router often only needs a base URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kind">Kind</Label>
            <select
              id="kind"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                if (e.target.value === "openai") setModels("gpt-4o-mini");
                if (e.target.value === "anthropic") setModels("claude-sonnet-4-6");
                if (e.target.value === "ninerouter") {
                  setBaseUrl("http://localhost:20128/v1");
                  setModels("xai/grok-4.5");
                }
              }}
            >
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Production OpenAI"
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="baseUrl">Base URL (optional for OpenAI/Anthropic defaults)</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={
                kind === "ninerouter"
                  ? "http://localhost:20128/v1"
                  : kind === "anthropic"
                    ? "https://api.anthropic.com"
                    : "https://api.openai.com/v1"
              }
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="apiKey">API key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... / sk-ant-... (write-only)"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="models">Models (comma-separated, custom IDs allowed)</Label>
            <Input id="models" value={models} onChange={(e) => setModels(e.target.value)} />
          </div>
          <div>
            <Button type="button" disabled={pending} onClick={onCreate}>
              Add provider
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured providers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workspace providers yet.
              {envBootstrap.enabled
                ? ` Env bootstrap active (${envBootstrap.providerCount} tier).`
                : " Configure a provider or set AI_GATEWAY_BASE_URL."}
            </p>
          ) : (
            initialProviders.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.label}</span>
                    <Badge variant="secondary">{p.kind}</Badge>
                    <Badge variant={p.isEnabled ? "default" : "outline"}>
                      {p.isEnabled ? "enabled" : "disabled"}
                    </Badge>
                    <Badge variant="outline">{p.hasApiKey ? "key set" : "no key"}</Badge>
                  </div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {p.baseUrl || "(default base)"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.models.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px]">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onTest(p.id)}
                  >
                    Test
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await updateWorkspaceAiProvider({
                            id: p.id,
                            isEnabled: !p.isEnabled,
                          });
                          refresh();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Update failed");
                        }
                      })
                    }
                  >
                    {p.isEnabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await deleteWorkspaceAiProvider(p.id);
                          refresh();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Delete failed");
                        }
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {envBootstrap.providers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Env bootstrap (process)</CardTitle>
            <CardDescription>
              Used when workspace has zero enabled providers. Configure via AI_GATEWAY_* or
              AI_PROVIDERS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {envBootstrap.providers.map((p) => (
              <div key={p.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="font-medium">{p.id}</div>
                <div className="font-mono text-xs text-muted-foreground">{p.baseUrl}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.models.map((m) => (
                    <Badge key={m} variant="outline" className="text-[10px]">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
