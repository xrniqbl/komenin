import { chatCompletionsAnthropic } from "@/lib/ai/anthropic";
import { getAiProviders, isAiGatewayEnabled, sortProviders } from "@/lib/ai/config";
import { chatCompletionsOpenAiCompatible } from "@/lib/ai/openai-compatible";
import type { AiChatRequest, AiChatResult, AiProviderConfig } from "@/lib/ai/types";

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
        const content = await completeWithProvider({
          provider,
          model,
          messages: request.messages,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
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
