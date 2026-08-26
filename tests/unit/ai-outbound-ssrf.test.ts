/**
 * AI provider SSRF hardening tests
 *
 * The adapters must route through safeOutboundFetch:
 * - redirects from the provider endpoint are refused (redirect: "error")
 * - DNS-resolved private/metadata targets are refused even when the stored
 *   baseUrl looked public at validation time
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompletionsOpenAiCompatible } from "@/lib/ai/openai-compatible";
import { chatCompletionsAnthropic } from "@/lib/ai/anthropic";
import type { AiProviderConfig } from "@/lib/ai/types";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(async (host: string) => {
      // example-public.test resolves to a public IP; repointed-private.test to private
      if (host === "example-public.test") return [{ address: "93.184.216.34", family: 4 }];
      if (host === "repointed-private.test") return [{ address: "10.0.0.5", family: 4 }];
      throw new Error("ENOTFOUND");
    }),
  },
  lookup: vi.fn(async (host: string) => {
    if (host === "example-public.test") return [{ address: "93.184.216.34", family: 4 }];
    if (host === "repointed-private.test") return [{ address: "10.0.0.5", family: 4 }];
    throw new Error("ENOTFOUND");
  }),
}));

const provider = (baseUrl: string, kind: AiProviderConfig["kind"] = "openai"): AiProviderConfig => ({
  id: "p1",
  kind,
  baseUrl,
  models: ["m1"],
  apiKey: "sk-test",
  timeoutMs: 2000,
  priority: 1,
});

const messages = [{ role: "user", content: "ping" }] as AiProviderConfig extends never
  ? never
  : [{ role: "user"; content: string }];

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALLOW_SECURITY_STUBS", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AI outbound fetch hardening", () => {
  it("openai-compatible refuses when baseUrl resolves to a private IP (DNS repoint)", async () => {
    await expect(
      chatCompletionsOpenAiCompatible({
        provider: provider("https://repointed-private.test/v1"),
        model: "m1",
        messages,
      }),
    ).rejects.toThrow(/private or blocked|not allowed|Unable to resolve/i);
  });

  it("anthropic refuses when baseUrl resolves to a private IP (DNS repoint)", async () => {
    await expect(
      chatCompletionsAnthropic({
        provider: provider("https://repointed-private.test", "anthropic"),
        model: "m1",
        messages,
      }),
    ).rejects.toThrow(/private or blocked|not allowed|Unable to resolve/i);
  });

  it("openai-compatible refuses localhost baseUrl", async () => {
    await expect(
      chatCompletionsOpenAiCompatible({
        provider: provider("http://127.0.0.1:8080/v1"),
        model: "m1",
        messages,
      }),
    ).rejects.toThrow(/not allowed|Only HTTPS/i);
  });

  it("does not follow redirects from the provider endpoint (SSRF via 302)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      chatCompletionsOpenAiCompatible({
        provider: provider("https://example-public.test/v1"),
        model: "m1",
        messages,
      }),
    ).rejects.toThrow();

    // The underlying fetch must be called with redirect:"error"
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe("error");
  });

  it("sends the bearer token to a safe public provider", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "hello" } }] }),
        { status: 200 },
      ),
    );

    const content = await chatCompletionsOpenAiCompatible({
      provider: provider("https://example-public.test/v1"),
      model: "m1",
      messages,
    });

    expect(content).toBe("hello");
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-test");
    expect(init.redirect).toBe("error");
  });
});
