import { beforeAll, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "@/lib/encryption";
import { runSessionConnector } from "@/lib/connectors/session";
import type { ConnectorActionInput } from "@/lib/connectors/types";

/**
 * The session connector is the unofficial path: it calls Instagram's private
 * mobile API with an imported cookie. Every test here injects a fake fetch —
 * no test may ever open a real connection to instagram.com.
 */

const ENCRYPTION_KEY = "a".repeat(64);

function makeBlob(cookies: Record<string, string>, platform = "instagram"): string {
  const payload = {
    platform,
    username: "brand.official",
    capturedAt: new Date().toISOString(),
    ua: "Instagram 155.0.0.37.107 Android (33/13)",
    cookies: Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      domain: platform === "threads" ? ".threads.net" : ".instagram.com",
      path: "/",
      secure: true,
      httpOnly: name === "sessionid",
    })),
    meta: { source: "test", cookieCount: Object.keys(cookies).length, requiredCookies: [], notes: "" },
  };
  return encryptSecret(JSON.stringify(payload));
}

const FULL_COOKIES = {
  sessionid: "sess-1",
  ds_user_id: "991",
  csrftoken: "csrf-1",
  mid: "mid-1",
};

function input(overrides: Partial<ConnectorActionInput>): ConnectorActionInput {
  return {
    action: "publishPost",
    runtimeMode: "live",
    policy: "session_only",
    target: { platform: "instagram", username: "brand.official" },
    payload: { body: "halo dunia" },
    ...overrides,
  } as ConnectorActionInput;
}

type Call = { url: string; init: RequestInit };

function makeFetch(handlers: Array<(url: string) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init: (init || {}) as RequestInit });
    const handler = handlers.shift();
    if (!handler) throw new Error(`Unexpected fetch: ${url}`);
    return handler(String(url));
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Decode the JSON payload out of a `signed_body=<sig>.<urlencoded json>` form
 * body. URLSearchParams encodes spaces as `+`, so decodeURIComponent alone
 * would leave `+` literals in captions.
 */
function signedPayload(body: unknown): string {
  const raw = new URLSearchParams(String(body)).get("signed_body") || "";
  return raw.slice(raw.indexOf(".") + 1);
}

beforeAll(() => {
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
});

describe("runSessionConnector — publishPost", () => {
  it("posts to Instagram via configure_text_post_app_feed with the caption", async () => {
    const { impl, calls } = makeFetch([
      () => jsonResponse({ status: "ok", pk: "12345_67890" }),
    ]);

    const result = await runSessionConnector(
      input({ target: { platform: "instagram", username: "brand" }, payload: { body: "tes post" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram", username: "brand" },
      { fetchImpl: impl },
    );

    expect(result.ok).toBe(true);
    expect(result.connector).toBe("session");
    expect(result.externalId).toBe("12345");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/v1/media/configure_text_post_app_feed/");
    expect(calls[0].url).toContain("i.instagram.com");

    const body = String(calls[0].init.body);
    const payload = signedPayload(body);
    expect(payload).toContain("tes post");
    expect(payload).toContain('"_uid":"991"');
  });

  it("posts to Threads via configure_text_only_post with the Barcelona agent", async () => {
    const { impl, calls } = makeFetch([
      () => jsonResponse({ status: "ok", pk: "999_111" }),
    ]);

    const result = await runSessionConnector(
      input({
        target: { platform: "threads", username: "brand" },
        payload: { body: "threads post", hashtags: ["#komenin"] },
      }),
      { encryptedBlob: makeBlob(FULL_COOKIES, "threads"), platform: "threads", username: "brand" },
      { fetchImpl: impl },
    );

    expect(result.ok).toBe(true);
    expect(calls[0].url).toContain("/api/v1/media/configure_text_only_post/");

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-ig-app-id"]).toBe("238260118697367");
    expect(headers["user-agent"]).toContain("Barcelona");

    const payload = signedPayload(calls[0].init.body);
    expect(payload).toContain("threads post");
    expect(payload).toContain("#komenin");
    expect(payload).toContain("text_post_app_info");
  });

  it("sends the Instagram app id on the Instagram path", async () => {
    const { impl, calls } = makeFetch([() => jsonResponse({ status: "ok", pk: "1_2" })]);
    await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-ig-app-id"]).toBe("567067343352427");
    expect(headers.cookie).toContain("sessionid=sess-1");
  });

  it("joins title, body and hashtags into one caption", async () => {
    const { impl, calls } = makeFetch([() => jsonResponse({ status: "ok" })]);
    await runSessionConnector(
      input({ payload: { title: "Judul", body: "Isi", hashtags: ["komenin", "#id"] } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    const payload = signedPayload(calls[0].init.body);
    expect(payload).toContain("Judul");
    expect(payload).toContain("Isi");
    expect(payload).toContain("#komenin");
    expect(payload).toContain("#id");
  });

  it("rejects an empty caption without touching the network", async () => {
    const { impl, calls } = makeFetch([]);
    const result = await runSessionConnector(
      input({ payload: { body: "", hashtags: [] } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/caption/i);
    expect(calls).toHaveLength(0);
  });
});

describe("runSessionConnector — sendComment", () => {
  it("resolves the post via oembed then comments on Instagram", async () => {
    const { impl, calls } = makeFetch([
      () => jsonResponse({ media_id: "555666_777" }),
      () => jsonResponse({ status: "ok", comment: { pk: "c-1" } }),
    ]);

    const result = await runSessionConnector(
      input({
        action: "sendComment",
        target: { platform: "instagram", username: "brand" },
        payload: { body: "mantap!", targetPostUrl: "https://www.instagram.com/p/ABC123/" },
      }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );

    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("c-1");

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/api/v1/oembed/?url=");
    expect(calls[0].url).toContain("ABC123");
    expect(calls[1].url).toContain("/api/v1/media/555666/comments/");

    const payload = signedPayload(calls[1].init.body);
    expect(payload).toContain("mantap!");
    expect(payload).toContain("comment_text");
  });

  it("accepts a bare shortcode and derives the post URL", async () => {
    const { impl, calls } = makeFetch([
      () => jsonResponse({ media_id: "1_2" }),
      () => jsonResponse({ status: "ok" }),
    ]);
    await runSessionConnector(
      input({
        action: "sendComment",
        payload: { body: "hi", targetPostUrl: "XYZ789" },
      }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(decodeURIComponent(calls[0].url)).toContain("XYZ789");
  });

  it("replies on Threads through configure_text_only_post with reply_id", async () => {
    const { impl, calls } = makeFetch([
      () => jsonResponse({ media_id: "31337_1" }),
      () => jsonResponse({ status: "ok", pk: "reply-1" }),
    ]);

    const result = await runSessionConnector(
      input({
        action: "sendComment",
        target: { platform: "threads" },
        payload: { body: "balasan", targetPostUrl: "https://www.threads.net/@x/post/CODE1/" },
      }),
      { encryptedBlob: makeBlob(FULL_COOKIES, "threads"), platform: "threads" },
      { fetchImpl: impl },
    );

    expect(result.ok).toBe(true);
    expect(calls[1].url).toContain("/api/v1/media/configure_text_only_post/");
    const payload = signedPayload(calls[1].init.body);
    expect(payload).toContain('"reply_id":"31337"');
  });

  it("fails closed when no target is supplied", async () => {
    const { impl, calls } = makeFetch([]);
    const result = await runSessionConnector(
      input({ action: "sendComment", payload: { body: "hi" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/target/i);
    expect(calls).toHaveLength(0);
  });

  it("fails closed on an empty comment body", async () => {
    const result = await runSessionConnector(
      input({ action: "sendComment", payload: { body: "   ", targetPostUrl: "ABC" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: makeFetch([]).impl },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/kosong/i);
  });

  it("rejects an over-long comment before sending", async () => {
    const { impl, calls } = makeFetch([]);
    const result = await runSessionConnector(
      input({
        action: "sendComment",
        payload: { body: "x".repeat(2500), targetPostUrl: "ABC" },
      }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/2\.200/);
    expect(calls).toHaveLength(0);
  });

  it("reports a missing post without attempting to comment", async () => {
    const { impl, calls } = makeFetch([() => jsonResponse({}, 404)]);
    const result = await runSessionConnector(
      input({
        action: "sendComment",
        payload: { body: "hi", targetPostUrl: "https://www.instagram.com/p/NOPE/" },
      }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("runSessionConnector — failure interpretation", () => {
  it("maps 401 to an expiry message", async () => {
    const { impl } = makeFetch([() => jsonResponse({ message: "login_required" }, 401)]);
    const result = await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/kedaluwarsa/i);
    expect(result.details?.signal).toBe("session_expired");
  });

  it("maps require_login to an expiry message even on HTTP 200", async () => {
    const { impl } = makeFetch([() => jsonResponse({ require_login: true }, 200)]);
    const result = await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(result.details?.signal).toBe("session_expired");
  });

  it("maps 429 to a rate-limit message", async () => {
    const { impl } = makeFetch([() => jsonResponse({}, 429)]);
    const result = await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/rate limit/i);
    expect(result.details?.signal).toBe("rate_limited");
  });

  it("flags a checkpoint challenge", async () => {
    const { impl } = makeFetch([
      () => jsonResponse({ checkpoint_url: "/challenge/1/", status: "checkpoint_required" }, 400),
    ]);
    const result = await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(result.details?.signal).toBe("checkpoint_required");
  });
});

describe("runSessionConnector — credential handling", () => {
  it("fails closed when the blob cannot be decrypted", async () => {
    const result = await runSessionConnector(
      input({}),
      { encryptedBlob: "v1:00:00:00", platform: "instagram" },
      { fetchImpl: makeFetch([]).impl },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/membuka sesi/i);
    expect(result.details?.signal).toBe("decrypt_failed");
  });

  it("fails closed when the stored payload lacks sessionid", async () => {
    const result = await runSessionConnector(
      input({}),
      {
        encryptedBlob: makeBlob({ csrftoken: "c", mid: "m" }),
        platform: "instagram",
      },
      { fetchImpl: makeFetch([]).impl },
    );
    expect(result.ok).toBe(false);
    expect(result.details?.signal).toBe("cookie_missing_sessionid");
  });

  it("never puts cookie values in the returned message or details", async () => {
    const { impl } = makeFetch([() => jsonResponse({}, 401)]);
    const result = await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("sess-1");
    expect(serialized).not.toContain("csrf-1");
  });

  it("refuses proxy rotation on the session path", async () => {
    const result = await runSessionConnector(
      input({ action: "rotateProxy", payload: { proxyId: "p1" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: makeFetch([]).impl },
    );
    expect(result.ok).toBe(false);
    expect(result.message).match(/proxy/i);
  });

  it("answers healthProbe without a network call", async () => {
    const { impl, calls } = makeFetch([]);
    const result = await runSessionConnector(
      input({ action: "healthProbe", payload: {} }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(true);
    expect(result.healthy).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("runSessionConnector — discoverPosts", () => {
  it("returns hashtag results and respects the limit", async () => {
    const section = (n: number) => ({
      layout_content: {
        medias: Array.from({ length: n }, (_, i) => ({
          media: {
            pk: `pk-${i}`,
            code: `code${i}`,
            caption: { text: `post ${i}` },
            user: { username: `user${i}` },
          },
        })),
      },
    });
    const { impl } = makeFetch([
      () => jsonResponse({ status: "ok", sections: [section(3), section(3)] }),
    ]);

    const result = await runSessionConnector(
      input({ action: "discoverPosts", payload: { query: "skincare", limit: 2 } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );

    expect(result.ok).toBe(true);
    expect(result.posts).toHaveLength(2);
    expect(result.posts?.[0].url).toContain("/p/code0/");
    expect(result.posts?.[0].platform).toBe("instagram");
  });

  it("fails closed when the hashtag yields nothing", async () => {
    const { impl } = makeFetch([() => jsonResponse({ status: "ok", sections: [] })]);
    const result = await runSessionConnector(
      input({ action: "discoverPosts", payload: { query: "kosong" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an empty hashtag query without a network call", async () => {
    const { impl, calls } = makeFetch([]);
    const result = await runSessionConnector(
      input({ action: "discoverPosts", payload: { query: "  " } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("runSessionConnector — signing", () => {
  it("uses the unsigned SIGNATURE prefix when no key is configured", async () => {
    const { impl, calls } = makeFetch([() => jsonResponse({ status: "ok" })]);
    await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(String(calls[0].init.body)).toContain("signed_body=SIGNATURE.");
    expect(String(calls[0].init.body)).toContain("ig_sig_key_version=4");
  });

  it("computes a real HMAC when a signature key is provided", async () => {
    const { impl, calls } = makeFetch([() => jsonResponse({ status: "ok" })]);
    await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl, signatureKey: "test-key" },
    );
    const body = String(calls[0].init.body);
    const sig = body.split("signed_body=")[1].split(".")[0];
    expect(sig).not.toBe("SIGNATURE");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("unmocked guard", () => {
  it("does not call global fetch when fetchImpl is provided", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const { impl } = makeFetch([() => jsonResponse({ status: "ok" })]);
    await runSessionConnector(
      input({ payload: { body: "x" } }),
      { encryptedBlob: makeBlob(FULL_COOKIES), platform: "instagram" },
      { fetchImpl: impl },
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
