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

async function meterAndComplete(input: {
  request: AiChatRequest & { workspaceId?: string | null };
  provider: AiProviderConfig;
  model: string;
}): Promise<string> {
  const { request, provider, model } = input;
  const workspaceId = request.workspaceId ?? null;

  // Resolve the funding source up front (fail-closed before the call).
  // Workspaces without workspaceId (env-bootstraped callers) skip metering.
  let source: "own_key" | "subscription" | "payg" = "own_key";
  if (workspaceId) {
    const { resolveAiBilling } = await import("@/lib/ai/billing");
    const billing = await resolveAiBilling({
      workspaceId,
      hasOwnProvider: Boolean(
        request.providers?.length && request.providers !== undefined &&
        request.providers.some((p) => p.id && !p.id.startsWith("env-")),
      ),
      preferOwnKey: true,
    });
    if (!billing.ok) {
      throw new AiQuotaExceededError(billing.message);
    }
    source = billing.source;
    if (billing.source !== "own_key") {
      // Komenin-funded calls route through the gateway provider, not the
      // workspace's own providers — the caller passes them via request.
      // Nothing to swap here: callers set `providers` to the gateway config
      // when they intend Komenin AI. We only record the source.
    }
  }

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

  for (const provider of orderedProviders) {
    const models = modelAttemptsForProvider(
      provider,
      request.preferredModel,
      request.fallbackModels,
    );
    for (const model of models) {
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
        // Quota failures are terminal — do not burn attempts on other providers.
        if (error instanceof AiQuotaExceededError) {
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
