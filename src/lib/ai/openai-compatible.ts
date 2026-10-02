import type { AiChatMessage, AiProviderConfig, AiTokenUsage } from "@/lib/ai/types";
import { safeOutboundFetch } from "@/lib/url-safety";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

function extractContent(payload: ChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "object" && part && "text" in part ? String(part.text || "") : ""))
      .join("")
      .trim();
  }
  return "";
}

export async function chatCompletionsOpenAiCompatible(input: {
  provider: AiProviderConfig;
  model: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; usage: AiTokenUsage | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.provider.timeoutMs ?? 20000,
  );

  try {
    // safeOutboundFetch re-resolves DNS at call time and refuses redirects,
    // so a provider baseUrl cannot be repointed at private/metadata targets
    // between validation and the actual request.
    const response = await safeOutboundFetch(
      `${input.provider.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(input.provider.apiKey
            ? { authorization: `Bearer ${input.provider.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxTokens ?? 280,
        }),
        signal: controller.signal,
      },
    );

    const payload = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
    if (!response.ok) {
      throw new Error(
        payload.error?.message || `AI provider HTTP ${response.status}`,
      );
    }

    const content = extractContent(payload);
    if (!content) {
      throw new Error("AI provider returned empty content");
    }
    // F4: real token usage when the provider reports it (OpenAI-compatible
    // `usage` block); null keeps the caller on the estimate path.
    const promptTokens = Number(payload.usage?.prompt_tokens);
    const completionTokens = Number(payload.usage?.completion_tokens);
    const usage =
      Number.isFinite(promptTokens) && Number.isFinite(completionTokens)
        ? {
            inputTokens: Math.max(0, Math.ceil(promptTokens)),
            outputTokens: Math.max(0, Math.ceil(completionTokens)),
          }
        : null;
    return { content, usage };
  } finally {
    clearTimeout(timeout);
  }
}