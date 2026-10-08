/**
 * Mention webhook receiver tests (F1).
 *
 * The exported helpers (parse/resolve/ingest/verify) are unit-tested directly;
 * the route handlers themselves only wire them to request/response shapes.
 * db is mocked because ingest touches Prisma.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("@/lib/db", () => ({
  db: {
    socialAccount: { findFirst: vi.fn() },
    connectorCredential: { findFirst: vi.fn() },
    mention: { upsert: vi.fn() },
    deliveryLog: { create: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  GET,
  POST,
  ingestMention,
  parseMetaChange,
  parseThreadsValue,
  parseTikTokValue,
  resolveMentionTarget,
  verifyTikTokSignature,
  verifyWebhookSignature,
} from "@/app/api/connectors/webhooks/[platform]/route";

const dbMock = db as unknown as {
  socialAccount: { findFirst: ReturnType<typeof vi.fn> };
  connectorCredential: { findFirst: ReturnType<typeof vi.fn> };
  mention: { upsert: ReturnType<typeof vi.fn> };
  deliveryLog: { create: ReturnType<typeof vi.fn> };
};

function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
  // deliveryLog.create is awaited then .catch()'d — return a resolved promise.
  dbMock.deliveryLog.create.mockResolvedValue({});
  dbMock.mention.upsert.mockResolvedValue({});
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ entry: [] });

  it("accepts a valid Meta sha256= signature", () => {
    expect(
      verifyWebhookSignature({
        secret: "s3cret",
        body,
        signatureHeader: sign("s3cret", body),
      }),
    ).toBe(true);
  });

  it("rejects a signature from a different secret", () => {
    expect(
      verifyWebhookSignature({
        secret: "s3cret",
        body,
        signatureHeader: sign("wrong", body),
      }),
    ).toBe(false);
  });

  it("fails closed on a missing signature header", () => {
    expect(
      verifyWebhookSignature({ secret: "s3cret", body, signatureHeader: null }),
    ).toBe(false);
  });
});

describe("verifyTikTokSignature", () => {
  const body = JSON.stringify({ event_type: "comment.create", data: {} });

  function tiktokSign(secret: string, ts: string, payload: string): string {
    const s = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
    return `t=${ts},s=${s}`;
  }

  it("accepts a valid t=<ts>,s=<hmac> signature over '<ts>.<body>'", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(
      verifyTikTokSignature({
        secret: "tt_secret",
        body,
        signatureHeader: tiktokSign("tt_secret", ts, body),
      }),
    ).toBe(true);
  });

  it("rejects a signature computed over the body alone (Meta-style)", () => {
    // The previous implementation verified TikTok like Meta (HMAC of the raw
    // body) — real TikTok events sign '<timestamp>.<body>' and must fail here.
    const metaStyle =
      "sha256=" + createHmac("sha256", "tt_secret").update(body).digest("hex");
    expect(
      verifyTikTokSignature({
        secret: "tt_secret",
        body,
        signatureHeader: metaStyle,
      }),
    ).toBe(false);
  });

  it("rejects a tampered body for a captured signature", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const header = tiktokSign("tt_secret", ts, body);
    expect(
      verifyTikTokSignature({
        secret: "tt_secret",
        body: body + " ",
        signatureHeader: header,
      }),
    ).toBe(false);
  });

  it("fails closed on missing or malformed headers", () => {
    expect(
      verifyTikTokSignature({ secret: "tt_secret", body, signatureHeader: null }),
    ).toBe(false);
    expect(
      verifyTikTokSignature({
        secret: "tt_secret",
        body,
        signatureHeader: `t=${Math.floor(Date.now() / 1000)}`,
      }),
    ).toBe(false);
  });

  it("rejects a stale timestamp (replay outside the 5-minute window)", () => {
    const staleTs = String(Math.floor(Date.now() / 1000) - 10 * 60);
    expect(
      verifyTikTokSignature({
        secret: "tt_secret",
        body,
        signatureHeader: tiktokSign("tt_secret", staleTs, body),
      }),
    ).toBe(false);
  });
});

describe("parseMetaChange", () => {
  it("normalizes an Instagram comment change into an ingest candidate", () => {
    const parsed = parseMetaChange({
      id: "17841400000000000",
      changes: [
        {
          field: "comments",
          value: {
            id: "comment_1",
            text: "keren banget!",
            from: { username: "fanuser" },
            media: { id: "media_9" },
          },
        },
      ],
    });
    expect(parsed).toMatchObject({
      platform: "instagram",
      externalId: "comment_1",
      parentExternalId: "media_9",
      authorHandle: "fanuser",
      content: "keren banget!",
      accountExternalId: "17841400000000000",
    });
  });

  it("returns null for non-comment changes", () => {
    expect(
      parseMetaChange({ changes: [{ field: "mentions", value: {} }] }),
    ).toBeNull();
  });
});

describe("parseThreadsValue", () => {
  it("maps replied_to as the parent id", () => {
    const parsed = parseThreadsValue("t_acc", {
      id: "reply_2",
      text: "setuju",
      username: "poster",
      replied_to: "thread_1",
    });
    expect(parsed).toMatchObject({
      platform: "threads",
      externalId: "reply_2",
      parentExternalId: "thread_1",
      authorHandle: "poster",
    });
  });

  it("falls back to itself when there is no parent", () => {
    const parsed = parseThreadsValue("t_acc", { id: "top_1", text: "hi" });
    expect(parsed?.parentExternalId).toBe("top_1");
  });
});

describe("parseTikTokValue", () => {
  it("normalizes a comment event", () => {
    const parsed = parseTikTokValue({
      event_type: "comment.create",
      data: {
        comment_id: "c_7",
        video_id: "v_3",
        text: "bagus",
        author_username: "tk_user",
      },
      creator_open_id: "creator_1",
    });
    expect(parsed).toMatchObject({
      platform: "tiktok",
      externalId: "c_7",
      parentExternalId: "v_3",
      authorHandle: "tk_user",
      content: "bagus",
      accountExternalId: "creator_1",
    });
  });

  it("ignores non-comment events", () => {
    expect(parseTikTokValue({ event_type: "video.publish" })).toBeNull();
  });
});

describe("resolveMentionTarget", () => {
  it("resolves via SocialAccount.externalId first", async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({
      id: "acc1",
      workspaceId: "ws1",
    });
    const target = await resolveMentionTarget({
      platform: "instagram",
      accountExternalId: "17841400000000000",
    });
    expect(target).toEqual({ workspaceId: "ws1", socialAccountId: "acc1" });
  });

  it("never falls back to a workspace credential for unknown accounts", async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue(null);
    dbMock.connectorCredential.findFirst.mockResolvedValue({
      workspaceId: "ws2",
    });
    const target = await resolveMentionTarget({
      platform: "tiktok",
      accountExternalId: null,
    });
    // A payload that names no known account must be dropped, not attributed to
    // whichever workspace happens to hold the first active credential.
    expect(target).toBeNull();
    expect(dbMock.connectorCredential.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when nothing resolves", async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue(null);
    const target = await resolveMentionTarget({
      platform: "threads",
      accountExternalId: "gone",
    });
    expect(target).toBeNull();
  });
});

describe("ingestMention", () => {
  const candidate = {
    platform: "instagram",
    externalId: "c_1",
    parentExternalId: "m_1",
    parentContent: "",
    authorHandle: "fan",
    content: "hello",
    url: null,
    accountExternalId: "acc_ext",
    raw: { kind: "meta_change" },
  };

  it("stores the mention and logs the delivery", async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({
      id: "acc1",
      workspaceId: "ws1",
    });
    const stored = await ingestMention(candidate as never);
    expect(stored).toBe(true);
    expect(dbMock.mention.upsert).toHaveBeenCalledTimes(1);
    const upsert = dbMock.mention.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({
      workspaceId_platform_externalId: {
        workspaceId: "ws1",
        platform: "instagram",
        externalId: "c_1",
      },
    });
    expect(upsert.create.status).toBe("new");
  });

  it("drops the mention (returns false) when no workspace resolves", async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue(null);
    dbMock.connectorCredential.findFirst.mockResolvedValue(null);
    const stored = await ingestMention(candidate as never);
    expect(stored).toBe(false);
    expect(dbMock.mention.upsert).not.toHaveBeenCalled();
  });

  it("drops self-authored mentions (self-reply loop guard)", async () => {
    // The receiving account is @brandacc; a comment written by @brandacc
    // itself must never become an auto-reply target.
    dbMock.socialAccount.findFirst.mockResolvedValue({
      id: "acc1",
      workspaceId: "ws1",
      username: "brandacc",
    });
    const stored = await ingestMention({
      ...candidate,
      authorHandle: "BrandAcc",
    } as never);
    expect(stored).toBe(false);
    expect(dbMock.mention.upsert).not.toHaveBeenCalled();
  });
});

describe("POST Meta batch", () => {
  const routeParams = { params: Promise.resolve({ platform: "instagram" }) };
  async function deliver(changes: string[]) {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("AUTH_SECRET", "test-secret-123456789");
    vi.stubEnv("AUTH_GOOGLE_ID", "test-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "test-secret");
    vi.stubEnv("ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("INSTAGRAM_APP_SECRET", "batch-secret");
    const body = JSON.stringify({ entry: [{ id: "account-ext", changes: changes.map((id) => ({ field: "comments", value: { id, text: `text ${id}`, from: { username: "fan" }, media: { id: "media" } } })) }] });
    return POST(new Request("https://app.example/api/connectors/webhooks/instagram", {
      method: "POST", body, headers: { "x-hub-signature-256": sign("batch-secret", body) },
    }), routeParams);
  }

  it("stores every comment change in one Meta entry", async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({ id: "account", workspaceId: "workspace" });
    const response = await deliver(["first", "second"]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: 2, stored: 2 });
    expect(dbMock.mention.upsert.mock.calls.map(([input]) => input.create.externalId)).toEqual(["first", "second"]);
  });

  it("returns retryable failure if a later comment fails after an earlier one stored", async () => {
    dbMock.socialAccount.findFirst.mockResolvedValue({ id: "account", workspaceId: "workspace" });
    dbMock.mention.upsert.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("database unavailable"));
    const response = await deliver(["first", "second"]);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ received: 2, stored: 1, failed: 1 });
  });
});

describe("GET handshake", () => {
  function handshakeRequest(query: string): Request {
    return new Request(
      `https://app.example/api/connectors/webhooks/instagram?${query}`,
    );
  }
  const routeParams = { params: Promise.resolve({ platform: "instagram" }) };

  it("echoes the challenge when the verify token matches", async () => {
    vi.stubEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "tok123");
    const res = await GET(
      handshakeRequest("hub.mode=subscribe&hub.challenge=abc&hub.verify_token=tok123"),
      routeParams,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("abc");
  });

  it("fails closed (503) when no verify token is configured", async () => {
    vi.stubEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "");
    const res = await GET(
      handshakeRequest("hub.mode=subscribe&hub.challenge=abc&hub.verify_token=whatever"),
      routeParams,
    );
    // An unconfigured endpoint must not complete Meta's subscription handshake
    // for arbitrary callers.
    expect(res.status).toBe(503);
  });

  it("rejects a mismatched verify token", async () => {
    vi.stubEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "tok123");
    const res = await GET(
      handshakeRequest("hub.mode=subscribe&hub.challenge=abc&hub.verify_token=nope"),
      routeParams,
    );
    expect(res.status).toBe(403);
  });
});
