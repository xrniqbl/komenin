import type { AiProviderConfig, AiProviderKind, AiRouterStatus } from "@/lib/ai/types";
import { DEFAULT_ANTHROPIC_BASE, DEFAULT_OPENAI_BASE } from "@/lib/ai/types";

function parseJsonProviders(raw?: string): AiProviderConfig[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const providers: AiProviderConfig[] = [];
    parsed.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const row = item as Record<string, unknown>;
      const kind = normalizeKind(String(row.kind || row.id || "openai_compatible"));
      const baseUrl = String(row.baseUrl || defaultBaseForKind(kind) || "")
        .trim()
        .replace(/\/$/, "");
      const models = Array.isArray(row.models)
        ? row.models.map(String).filter(Boolean)
        : String(row.model || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
      if (!baseUrl || models.length === 0) return;

      providers.push({
        id: String(row.id || `provider-${index + 1}`),
        kind,
        baseUrl,
        apiKey: row.apiKey ? String(row.apiKey) : undefined,
        models,
        timeoutMs: row.timeoutMs ? Number(row.timeoutMs) : 20000,
        priority: row.priority != null ? Number(row.priority) : 100 + index,
      });
    });
    return providers;
  } catch {
    return [];
  }
}

export function normalizeKind(raw: string): AiProviderKind {
  const value = raw.trim().toLowerCase();
  if (value === "ninerouter" || value === "9router" || value === "gateway") {
    return "ninerouter";
  }
  if (value === "openai") return "openai";
  if (value === "anthropic" || value === "claude") return "anthropic";
  return "openai_compatible";
}

export function defaultBaseForKind(kind: AiProviderKind): string | null {
  switch (kind) {
    case "openai":
      return DEFAULT_OPENAI_BASE;
    case "anthropic":
      return DEFAULT_ANTHROPIC_BASE;
    case "ninerouter":
      return process.env.AI_GATEWAY_BASE_URL?.trim().replace(/\/$/, "") || null;
    default:
      return null;
  }
}

function parseLegacyGateway(): AiProviderConfig[] {
  const baseUrl = process.env.AI_GATEWAY_BASE_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return [];

  const models = [
    process.env.AI_MODEL_PRIMARY,
    ...(process.env.AI_MODEL_FALLBACKS || "")
      .split(",")
      .map((value) => value.trim()),
  ].filter((value): value is string => Boolean(value));

  if (models.length === 0) {
    models.push("gpt-4o-mini");
  }

  return [
    {
      id: "gateway",
      kind: "ninerouter",
      baseUrl,
      apiKey: process.env.AI_GATEWAY_API_KEY || undefined,
      models,
      timeoutMs: Number(process.env.AI_TIMEOUT_MS || 20000),
      priority: 50,
    },
  ];
}

/** Env / process-level providers (platform bootstrap). */
export function getAiProviders(): AiProviderConfig[] {
  const fromJson = parseJsonProviders(process.env.AI_PROVIDERS);
  if (fromJson.length > 0) return fromJson;
  return parseLegacyGateway();
}

export function isAiGatewayEnabled(): boolean {
  const flag = process.env.AI_GATEWAY_ENABLED ?? "true";
  if (flag === "false") return false;
  return getAiProviders().length > 0;
}

export function getAiRouterStatus(): AiRouterStatus {
  const providers = getAiProviders();
  return {
    enabled: isAiGatewayEnabled(),
    providerCount: providers.length,
    providers: providers.map((provider) => ({
      id: provider.id,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      models: provider.models,
      hasApiKey: Boolean(provider.apiKey),
    })),
    localFallback: true,
    source: "env",
  };
}

export function sortProviders(providers: AiProviderConfig[]): AiProviderConfig[] {
  return [...providers].sort(
    (a, b) => (a.priority ?? 100) - (b.priority ?? 100) || a.id.localeCompare(b.id),
  );
}
