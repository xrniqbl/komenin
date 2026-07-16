import { getAiProviders, isAiGatewayEnabled } from "@/lib/ai/config";
import { chatCompletionsOpenAiCompatible } from "@/lib/ai/openai-compatible";
import type { AiChatRequest, AiChatResult } from "@/lib/ai/types";

export async function routeChatCompletion(
  request: AiChatRequest,
): Promise<AiChatResult | null> {
  if (!isAiGatewayEnabled()) return null;

  const providers = getAiProviders();
  const attempts: AiChatResult["attempts"] = [];

  for (const provider of providers) {
    for (const model of provider.models) {
      try {
        const content = await chatCompletionsOpenAiCompatible({
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