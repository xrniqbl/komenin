import { chatCompletionsAnthropic } from "@/lib/ai/anthropic";
import { getAiProviders, isAiGatewayEnabled, sortProviders } from "@/lib/ai/config";
import { chatCompletionsOpenAiCompatible } from "@/lib/ai/openai-compatible";
import type { AiChatRequest, AiChatResult, AiProviderConfig } from "@/lib/ai/types";

/** Error thrown when the workspace has no available AI credit source. */
export class AiQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiQuotaExceededError";
  }
}

/** Error thrown when a requested model is not allowed for the workspace tier. */
export class AiModelNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiModelNotAllowedError";
  }
}

async function completeWithProvider(input: {
  provider: AiProviderConfig;
  model: string;
  messages: AiChatRequest["messages"];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  if (input.provider.kind === "anthropic") {
    return chatCompletionsAnthropic(input);
  }
  return chatCompletionsOpenAiCompatible(input);
}

/** Rough token estimate when a provider does not report usage: chars/4. */
function estimateTokens(messages: AiChatRequest["messages"]): number {
  const chars = messages.reduce(
    (sum, message) => sum + message.content.length,
    0,
  );
  return Math.ceil(chars / 4);
}

import type { AiTier } from "@prisma/client";

/**
 * Resolve the funding source for a workspace AI call once, up front, so the
 * router can both fail-closed on quota and enforce the tier's model allowlist
 * before any provider attempt. Returns the source and tier.
 */
export async function resolveRouteFunding(
  request: AiChatRequest & { workspaceId?: string | null },
): Promise<{ source: "own_key" | "subscription" | "payg"; tier: AiTier }> {
  const workspaceId = request.workspaceId ?? null;
  if (!workspaceId) {
    return { source: "own_key", tier: "none" };
  }
  const { resolveAiBilling } = await import("@/lib/ai/billing");
  const billing = await resolveAiBilling({
    workspaceId,
    hasOwnProvider: Boolean(
      request.providers?.length &&
        request.providers !== undefined &&
        request.providers.some((p) => p.id && !p.id.startsWith("env-")),
    ),
  });
  if (!billing.ok) {
    throw new AiQuotaExceededError(billing.message);
  }
  return { source: billing.source, tier: billing.tier };
}

async function meterAndComplete(input: {
  request: AiChatRequest & { workspaceId?: string | null };
  provider: AiProviderConfig;
  model: string;
  funding: { source: "own_key" | "subscription" | "payg"; tier: AiTier };
}): Promise<string> {
  const { request, provider, model, funding } = input;
  const workspaceId = request.workspaceId ?? null;
  const source = funding.source;

  const startedAt = Date.now();
  const content = await completeWithProvider({
    provider,
    model,
    messages: request.messages,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
  });
  const latencyMs = Date.now() - startedAt;

  if (workspaceId) {
    // Record usage (BYOK = zero-credit analytics row). Never let metering
    // failures break a successful completion.
    try {
      const { recordAiUsage } = await import("@/lib/ai/billing");
      const estimate = estimateTokens(request.messages) + content.length / 4;
      await recordAiUsage({
        workspaceId,
        source,
        model,
        inputTokens: Math.ceil(estimate * 0.3),
        outputTokens: Math.ceil(estimate * 0.7),
        providerId: provider.id,
        latencyMs,
        refType: request.refType ?? null,
        refId: request.refId ?? null,
        // Providers here don't return a usage object yet, so tokens are estimated.
        reported: false,
      });
    } catch (error) {
      console.warn("[ai-router] metering failed (call succeeded):", error);
    }
  }

  return content;
}

function modelAttemptsForProvider(
  provider: AiProviderConfig,
  preferredModel?: string | null,
  fallbackModels?: string[],
): string[] {
  const ordered: string[] = [];
  const push = (model?: string | null) => {
    const value = model?.trim();
    if (!value) return;
    if (!ordered.includes(value)) ordered.push(value);
  };

  push(preferredModel);
  for (const model of fallbackModels || []) push(model);
  for (const model of provider.models) push(model);
  return ordered;
}

export async function routeChatCompletion(
  request: AiChatRequest,
): Promise<AiChatResult | null> {
  const providers = sortProviders(
    request.providers && request.providers.length > 0
      ? request.providers
      : getAiProviders(),
  );

  if (providers.length === 0) {
    if (!isAiGatewayEnabled() && !(request.providers && request.providers.length)) {
      return null;
    }
    return null;
  }

  // Prefer a specific provider first when requested.
  const orderedProviders = (() => {
    if (!request.preferredProviderId) return providers;
    const preferred = providers.filter((p) => p.id === request.preferredProviderId);
    const rest = providers.filter((p) => p.id !== request.preferredProviderId);
    return [...preferred, ...rest];
  })();

  const attempts: AiChatResult["attempts"] = [];

  // Resolve funding once (fail-closed on quota) and learn the tier so we can
  // enforce the server-side model allowlist for Komenin-funded calls.
  const funding = await resolveRouteFunding(request);
  const enforceAllowlist = funding.source !== "own_key";
  const { isModelAllowedForTier, allowedModelsForTier } = await import(
    "@/lib/ai/models"
  );

  for (const provider of orderedProviders) {
    const models = modelAttemptsForProvider(
      provider,
      request.preferredModel,
      request.fallbackModels,
    );
    for (const model of models) {
      // Server-side tier allowlist for Komenin-funded calls. BYOK (own key)
      // is unrestricted — the workspace pays its own provider bill.
      if (enforceAllowlist && !isModelAllowedForTier(funding.tier, model)) {
        attempts.push({
          providerId: provider.id,
          model,
          ok: false,
          error: `Model "${model}" tidak termasuk tier ${funding.tier}. Diizinkan: ${(allowedModelsForTier(funding.tier) ?? []).join(", ")}`,
        });
        // If the caller explicitly pinned this model, fail fast with a clear
        // error rather than silently falling back to a cheaper one.
        if (request.preferredModel === model) {
          throw new AiModelNotAllowedError(
            `Model "${model}" tidak tersedia untuk tier ${funding.tier}. Upgrade tier atau pilih model yang diizinkan.`,
          );
        }
        continue;
      }
      // Skip preferred model if this provider does not list it, unless it was explicitly preferred.
      if (
        request.preferredModel &&
        model === request.preferredModel &&
        provider.models.length > 0 &&
        !provider.models.includes(model) &&
        provider.id !== request.preferredProviderId
      ) {
        // Still allow free-form custom model when provider is preferred or model is in list.
      }
      try {
        const content = await meterAndComplete({
          request: { ...request, providers },
          provider,
          model,
          funding,
        });
        attempts.push({ providerId: provider.id, model, ok: true });
        return {
          content,
          providerId: provider.id,
          model,
          mode: "gateway",
          attempts,
        };
      } catch (error) {
        // Quota / allowlist failures are terminal — do not burn attempts.
        if (
          error instanceof AiQuotaExceededError ||
          error instanceof AiModelNotAllowedError
        ) {
          throw error;
        }
        attempts.push({
          providerId: provider.id,
          model,
          ok: false,
          error: error instanceof Error ? error.message : "Unknown AI error",
        });
      }
    }
  }

  return {
    content: "",
    providerId: "none",
    model: "none",
    mode: "gateway",
    attempts,
  };
}
