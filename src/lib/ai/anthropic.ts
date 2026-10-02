import type { AiChatMessage, AiProviderConfig, AiTokenUsage } from "@/lib/ai/types";
import { safeOutboundFetch } from "@/lib/url-safety";

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: { message?: string; type?: string };
};

function toAnthropicMessages(messages: AiChatMessage[]): {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemParts: string[] = [];
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }
    out.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    });
  }
  // Anthropic requires alternating roles starting with user; coalesce if needed.
  if (out.length === 0) {
    out.push({ role: "user", content: "Hello" });
  }
  if (out[0]?.role !== "user") {
    out.unshift({ role: "user", content: "(context)" });
  }
  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    messages: out,
  };
}

export async function chatCompletionsAnthropic(input: {
  provider: AiProviderConfig;
  model: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; usage: AiTokenUsage | null }> {
  if (!input.provider.apiKey) {
    throw new Error("Anthropic API key required");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.provider.timeoutMs ?? 20000,
  );

  const mapped = toAnthropicMessages(input.messages);
  const base = input.provider.baseUrl.replace(/\/$/, "");

  try {
    // safeOutboundFetch re-resolves DNS at call time and refuses redirects,
    // closing the SSRF redirect/DNS-repoint window on the stored baseUrl.
    const response = await safeOutboundFetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens ?? 280,
        temperature: input.temperature ?? 0.4,
        system: mapped.system,
        messages: mapped.messages,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as AnthropicMessageResponse;
    if (!response.ok) {
      throw new Error(
        payload.error?.message || `Anthropic HTTP ${response.status}`,
      );
    }

    const text = (payload.content || [])
      .filter((part) => part.type === "text" || Boolean(part.text))
      .map((part) => part.text || "")
      .join("")
      .trim();
    if (!text) throw new Error("Anthropic returned empty content");
    // F4: Anthropic always reports usage in the messages response.
    const usage =
      Number.isFinite(payload.usage?.input_tokens) &&
      Number.isFinite(payload.usage?.output_tokens)
        ? {
            inputTokens: Math.max(0, Math.ceil(payload.usage!.input_tokens!)),
            outputTokens: Math.max(0, Math.ceil(payload.usage!.output_tokens!)),
          }
        : null;
    return { content: text, usage };
  } finally {
    clearTimeout(timeout);
  }
}
