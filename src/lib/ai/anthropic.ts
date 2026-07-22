import type { AiChatMessage, AiProviderConfig } from "@/lib/ai/types";

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
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
}): Promise<string> {
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
    const response = await fetch(`${base}/v1/messages`, {
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
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
