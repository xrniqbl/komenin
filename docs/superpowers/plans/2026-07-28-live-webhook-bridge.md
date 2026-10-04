# Live Webhook Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved live social delivery path by shipping an in-repo mock social bridge, hardening webhook client tests, documenting the integrator contract, and aligning env/readiness so operators can run `SIMULATOR_MODE=false` against a real or mock bridge without false success.

**Architecture:** Komenin already posts connector actions to `SOCIAL_PUBLISH_WEBHOOK_URL` and validates 2xx JSON via `parseBridgeSuccessPayload`. This plan adds a separate Node mock bridge process (port 8787) that implements contract v1 for all five actions, pure handler unit tests, webhook client fail-closed tests with mocked fetch, npm scripts, and operator docs. No Next.js route may impersonate the live bridge.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Node `http` + `tsx`, existing `safeOutboundFetch` / `url-safety`, connector router.

**Spec:** `docs/superpowers/specs/2026-07-28-live-webhook-bridge-design.md` (approved)

## Global Constraints

- Primary live path remains **external webhook bridge**; native Graph/TikTok completion is out of scope.
- Contract version header: `x-komenin-contract: v1` (request required; response recommended).
- Auth: `Authorization: Bearer <token>` required for mock and live.
- Empty `discoverPosts` success creates **zero** `targetPost` rows (no invent in live — already enforced in workers).
- Malformed posts in an array are **filtered**; non-array `posts` fails the call.
- No connector-level multi-retry (avoid double comments).
- `POST /api/publish/webhook` stays a delivery log only; production-gate must keep blocking self-`APP_URL` + that path.
- Local mock: default `http://127.0.0.1:8787/bridge`. Calling it from the app requires `ALLOW_SECURITY_STUBS=true` in non-production because `assertSafeOutboundUrl` blocks localhost unless stubs are enabled (`src/lib/url-safety.ts`). Document this explicitly.
- YAGNI: no Redis, no durable queue rewrite, no Settings HTTP probe button in v1 (optional later).
- Prefer small pure modules; mock handler must be unit-testable without binding a port.

### Already shipped (do not redo unless tests fail)

| Piece | Location |
|---|---|
| Contract parser | `src/lib/connectors/bridge-contract.ts` |
| Contract unit tests | `tests/unit/bridge-contract.test.ts` |
| Webhook client validation + header | `src/lib/connectors/webhook.ts` |
| Live poll no-invent + upsert | `src/server/worker-jobs.ts`, `src/server/listeners.ts` |
| Self-webhook gate / readiness | `src/lib/production-gate.ts`, `src/lib/runtime-mode.ts` |
| Publisher vs notify copy | settings publisher / webhooks pages |

### Remaining gaps this plan closes

1. Runnable mock bridge + pure handlers
2. Webhook **client** unit tests (mocked fetch)
3. npm scripts + `.env.example` mock runbook
4. Integrator doc + production checklist mock section
5. Spec status update (baseline note)

---

## File map

| File | Responsibility |
|---|---|
| `bridges/mock-social/handler.ts` | Pure request→response for 5 actions (no I/O) |
| `bridges/mock-social/server.ts` | Node HTTP server: auth, JSON parse, call handler, headers |
| `bridges/mock-social/README.md` | How to run and point Komenin at the mock |
| `tests/unit/mock-social-bridge.test.ts` | Handler contract fixtures |
| `tests/unit/webhook-connector.test.ts` | `runWebhookConnector` with mocked `safeOutboundFetch` |
| `package.json` | `bridge:mock` script |
| `.env.example` | Mock URL + token + stubs note |
| `docs/BRIDGE-CONTRACT.md` | Integrator-facing contract + examples |
| `docs/PRODUCTION-CHECKLIST.md` | Mock bridge runbook checkbox section |
| `docs/superpowers/specs/2026-07-28-live-webhook-bridge-design.md` | Mark baseline items done; status → implementation plan ready |

---

### Task 1: Mock bridge pure handler

**Files:**
- Create: `bridges/mock-social/handler.ts`
- Test: `tests/unit/mock-social-bridge.test.ts`

**Interfaces:**
- Consumes: none (standalone; mirror contract field names from spec)
- Produces:
  - `export type MockBridgeRequest` — action payload fields (`action`, `platform`, `query`, `limit`, `body`, targets, etc.)
  - `export type MockBridgeResponse = { status: number; body: Record<string, unknown>; headers?: Record<string, string> }`
  - `export function handleMockBridgeRequest(req: MockBridgeRequest): MockBridgeResponse`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/mock-social-bridge.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { handleMockBridgeRequest } from "../../bridges/mock-social/handler";

describe("mock social bridge handler", () => {
  it("returns 1+ valid discover posts for a query", () => {
    const res = handleMockBridgeRequest({
      action: "discoverPosts",
      platform: "instagram",
      query: "kopi",
      limit: 2,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.posts)).toBe(true);
    const posts = res.body.posts as Array<Record<string, string>>;
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts.length).toBeLessThanOrEqual(2);
    for (const p of posts) {
      expect(p.externalId).toBeTruthy();
      expect(p.authorHandle).toBeTruthy();
      expect(p.content).toBeTruthy();
      expect(p.url).toBeTruthy();
      expect(p.platform).toBe("instagram");
    }
  });

  it("returns mock_ externalId for sendComment and publishPost", () => {
    const comment = handleMockBridgeRequest({
      action: "sendComment",
      platform: "threads",
      body: "nice post",
      targetPostExternalId: "post_1",
    });
    expect(comment.status).toBe(200);
    expect(String(comment.body.externalId || "")).toMatch(/^mock_/);

    const publish = handleMockBridgeRequest({
      action: "publishPost",
      platform: "instagram",
      body: "hello world",
      caption: "hello world",
    });
    expect(publish.status).toBe(200);
    expect(String(publish.body.externalId || "")).toMatch(/^mock_/);
  });

  it("healthProbe returns healthy true and rotateProxy returns TEST-NET ip", () => {
    const health = handleMockBridgeRequest({
      action: "healthProbe",
      platform: "instagram",
      hasSession: true,
      proxyHealthy: true,
    });
    expect(health.status).toBe(200);
    expect(health.body.healthy).toBe(true);

    const rotate = handleMockBridgeRequest({
      action: "rotateProxy",
      platform: "instagram",
      proxyId: "px1",
      seed: "abc",
    });
    expect(rotate.status).toBe(200);
    expect(rotate.body.ip).toBe("203.0.113.10");
  });

  it("rejects unknown action with 400 ok false", () => {
    const res = handleMockBridgeRequest({ action: "nope", platform: "instagram" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(String(res.body.error || res.body.message || "")).toMatch(/unsupported|unknown/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/mock-social-bridge.test.ts`

Expected: FAIL (cannot resolve `../../bridges/mock-social/handler` or export missing)

- [ ] **Step 3: Write minimal implementation**

Create `bridges/mock-social/handler.ts`:

```ts
export type MockBridgeRequest = {
  action: string;
  platform?: string;
  query?: string;
  limit?: number;
  body?: string;
  targetPostExternalId?: string | null;
  targetPostUrl?: string | null;
  authorHandle?: string | null;
  title?: string | null;
  hashtags?: string[];
  caption?: string;
  hasSession?: boolean;
  proxyHealthy?: boolean | null;
  proxyId?: string | null;
  seed?: string | null;
  idempotencyKey?: string | null;
  [key: string]: unknown;
};

export type MockBridgeResponse = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

function slug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "query"
  );
}

export function handleMockBridgeRequest(req: MockBridgeRequest): MockBridgeResponse {
  const platform = (req.platform || "instagram").toLowerCase();
  const headers = { "x-komenin-contract": "v1" };

  switch (req.action) {
    case "discoverPosts": {
      const limit = Math.min(Math.max(Number(req.limit) || 3, 1), 5);
      const q = slug(String(req.query || "trend"));
      const posts = Array.from({ length: limit }, (_, i) => {
        const externalId = `mock_${platform}_${q}_${i + 1}`;
        return {
          externalId,
          authorHandle: `mock_user_${i + 1}`,
          content: `Mock discovery for "${req.query || "trend"}" #${i + 1}`,
          url: `https://example.com/mock/${externalId}`,
          platform,
        };
      });
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          message: `Mock discovered ${posts.length} posts`,
          posts,
        },
      };
    }
    case "sendComment": {
      const target = req.targetPostExternalId || "unknown";
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          externalId: `mock_comment_${platform}_${target}`.slice(0, 120),
          message: "Mock comment accepted",
        },
      };
    }
    case "publishPost": {
      const seed = slug(String(req.caption || req.body || "post"));
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          externalId: `mock_post_${platform}_${seed}`,
          message: "Mock publish accepted",
        },
      };
    }
    case "healthProbe": {
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          healthy: true,
          message: "Mock health ok",
        },
      };
    }
    case "rotateProxy": {
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          ip: "203.0.113.10",
          message: "Mock proxy rotated",
        },
      };
    }
    default:
      return {
        status: 400,
        headers,
        body: {
          ok: false,
          error: `Unsupported mock bridge action: ${req.action || "(missing)"}`,
        },
      };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/mock-social-bridge.test.ts`

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add bridges/mock-social/handler.ts tests/unit/mock-social-bridge.test.ts
git commit -m "feat: add pure mock social bridge handler"
```

---

### Task 2: Mock bridge HTTP server + npm script

**Files:**
- Create: `bridges/mock-social/server.ts`
- Create: `bridges/mock-social/README.md`
- Modify: `package.json` (scripts)
- Modify: `.env.example` (mock section)

**Interfaces:**
- Consumes: `handleMockBridgeRequest` from `./handler`
- Produces: HTTP server on `127.0.0.1:${MOCK_BRIDGE_PORT||8787}`, `POST /bridge`, `GET /healthz`
- Env: `MOCK_BRIDGE_TOKEN` required (min 8 chars) or process exits 1; `MOCK_BRIDGE_PORT` optional

- [ ] **Step 1: Implement server**

Create `bridges/mock-social/server.ts`:

```ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleMockBridgeRequest } from "./handler";

const PORT = Number(process.env.MOCK_BRIDGE_PORT || 8787);
const TOKEN = (process.env.MOCK_BRIDGE_TOKEN || "").trim();
const PATH = "/bridge";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-komenin-contract": "v1",
    ...(extraHeaders || {}),
  });
  res.end(payload);
}

async function main() {
  if (!TOKEN || TOKEN.length < 8) {
    console.error("MOCK_BRIDGE_TOKEN is required (min 8 chars). Refusing to start.");
    process.exit(1);
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
      if (req.method === "GET" && url.pathname === "/healthz") {
        send(res, 200, { ok: true, service: "mock-social-bridge" });
        return;
      }
      if (req.method !== "POST" || url.pathname.replace(/\/$/, "") !== PATH) {
        send(res, 404, { ok: false, error: "Not found. POST /bridge" });
        return;
      }

      const auth = req.headers.authorization || "";
      const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
      if (!bearer || bearer !== TOKEN) {
        send(res, 401, { ok: false, error: "Unauthorized bridge token" });
        return;
      }

      const raw = await readBody(req);
      let json: Record<string, unknown> = {};
      if (raw.trim()) {
        try {
          json = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          send(res, 400, { ok: false, error: "Invalid JSON body" });
          return;
        }
      }

      const actionHeader = req.headers["x-komenin-action"];
      if (!json.action && typeof actionHeader === "string") {
        json.action = actionHeader;
      }

      const result = handleMockBridgeRequest(
        json as Parameters<typeof handleMockBridgeRequest>[0],
      );
      send(res, result.status, result.body, result.headers);
    } catch (error) {
      send(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Mock bridge error",
      });
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Mock social bridge listening on http://127.0.0.1:${PORT}${PATH}`);
    console.log("Set SOCIAL_PUBLISH_WEBHOOK_URL to that URL and matching token.");
    console.log(
      "App outbound to localhost requires ALLOW_SECURITY_STUBS=true (non-production).",
    );
  });
}

main();
```

- [ ] **Step 2: Write README**

Create `bridges/mock-social/README.md`:

```markdown
# Mock social bridge

Contract v1 stand-in for Komenin live connectors. **Not** the same as
`POST /api/publish/webhook` (in-app delivery log).

## Run

```bash
# from repo root
MOCK_BRIDGE_TOKEN=dev-bridge-token-please-change npm run bridge:mock
```

Listens on `http://127.0.0.1:8787/bridge`.

## Point Komenin at it (local)

```env
SIMULATOR_MODE=false
ALLOW_SECURITY_STUBS=true
SOCIAL_PUBLISH_WEBHOOK_URL=http://127.0.0.1:8787/bridge
SOCIAL_PUBLISH_WEBHOOK_TOKEN=dev-bridge-token-please-change
SOCIAL_CONNECTOR_POLICY=prefer_webhook
```

`ALLOW_SECURITY_STUBS=true` is required so `safeOutboundFetch` allows
localhost HTTP outside production.

## Actions

`discoverPosts`, `sendComment`, `publishPost`, `healthProbe`, `rotateProxy`.

See `docs/BRIDGE-CONTRACT.md`.
```

- [ ] **Step 3: Wire package.json and .env.example**

In `package.json` `scripts`, add:

```json
"bridge:mock": "tsx bridges/mock-social/server.ts"
```

Near the social webhook block in `.env.example`, add:

```env
# Local mock bridge (separate process: npm run bridge:mock). Not the app logger.
# MOCK_BRIDGE_TOKEN="dev-bridge-token-please-change"
# MOCK_BRIDGE_PORT="8787"
# For app → mock on 127.0.0.1, also set ALLOW_SECURITY_STUBS=true (never in production).
# SOCIAL_PUBLISH_WEBHOOK_URL="http://127.0.0.1:8787/bridge"
# SOCIAL_PUBLISH_WEBHOOK_TOKEN="dev-bridge-token-please-change"
```

- [ ] **Step 4: Manual smoke**

Terminal A:

```bash
MOCK_BRIDGE_TOKEN=dev-bridge-token-please-change npm run bridge:mock
```

Terminal B:

```bash
curl -sS -X POST http://127.0.0.1:8787/bridge \
  -H "authorization: Bearer dev-bridge-token-please-change" \
  -H "content-type: application/json" \
  -H "x-komenin-action: discoverPosts" \
  -H "x-komenin-contract: v1" \
  -d "{\"action\":\"discoverPosts\",\"platform\":\"instagram\",\"query\":\"kopi\",\"limit\":2}"
```

Expected: JSON with `ok: true`, `posts` length 2, `externalId` values starting with `mock_`.

Without `Authorization` header → HTTP 401.

- [ ] **Step 5: Commit**

```bash
git add bridges/mock-social/server.ts bridges/mock-social/README.md package.json .env.example
git commit -m "feat: add runnable mock social bridge server"
```

---

### Task 3: Webhook connector client tests

**Files:**
- Create: `tests/unit/webhook-connector.test.ts`
- Reference (modify only if a test reveals a real bug): `src/lib/connectors/webhook.ts`

**Interfaces:**
- Consumes: `runWebhookConnector` from `@/lib/connectors/webhook`
- Mocks: `safeOutboundFetch` from `@/lib/url-safety` via `vi.mock`

- [ ] **Step 1: Write the tests**

Create `tests/unit/webhook-connector.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeOutboundFetch } from "@/lib/url-safety";
import { runWebhookConnector } from "@/lib/connectors/webhook";
import type { ConnectorActionInput } from "@/lib/connectors/types";

vi.mock("@/lib/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/url-safety")>(
    "@/lib/url-safety",
  );
  return {
    ...actual,
    safeOutboundFetch: vi.fn(),
  };
});

const fetchMock = safeOutboundFetch as unknown as ReturnType<typeof vi.fn>;

function baseInput(over: Partial<ConnectorActionInput> = {}): ConnectorActionInput {
  return {
    action: "sendComment",
    runtimeMode: "live",
    policy: "prefer_webhook",
    target: { platform: "instagram", username: "brand", accountId: "acc1" },
    payload: {
      body: "hi",
      targetPostExternalId: "p1",
      targetPostUrl: "https://example.com/p/1",
      authorHandle: "user",
    },
    webhook: {
      url: "https://bridge.example/hooks/komenin",
      token: "super-secret-token",
    },
    official: null,
    ...over,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("runWebhookConnector", () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("marks sendComment ok on valid 200 JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, externalId: "c_1" }));
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("c_1");
    expect(result.connector).toBe("webhook");
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers["x-komenin-contract"]).toBe("v1");
    expect(init.headers.authorization).toBe("Bearer super-secret-token");
  });

  it("fails on HTTP 200 with ok:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: false, error: "upstream denied" }),
    );
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/upstream denied|Invalid bridge/i);
  });

  it("fails on non-JSON 200 body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not JSON/i);
  });

  it("fails on HTTP 500", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/boom|500/i);
  });

  it("accepts empty discover posts without inventing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, posts: [] }));
    const result = await runWebhookConnector(
      baseInput({
        action: "discoverPosts",
        payload: { query: "x", limit: 3 },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.posts).toEqual([]);
  });

  it("fails when posts is not an array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { posts: "nope" }));
    const result = await runWebhookConnector(
      baseInput({
        action: "discoverPosts",
        payload: { query: "x" },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/posts must be an array/i);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/webhook-connector.test.ts`

Expected: PASS (client already validates). If any assertion fails on header shape, adjust the test to the actual plain-object headers in `webhook.ts` — do **not** weaken fail-closed validation.

- [ ] **Step 3: Run related unit suite**

Run:

```bash
npx vitest run tests/unit/bridge-contract.test.ts tests/unit/webhook-connector.test.ts tests/unit/mock-social-bridge.test.ts
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add tests/unit/webhook-connector.test.ts
git commit -m "test: cover webhook bridge client fail-closed paths"
```

If a real bug fix in `webhook.ts` was required:

```bash
git add tests/unit/webhook-connector.test.ts src/lib/connectors/webhook.ts
git commit -m "fix: keep webhook bridge client fail-closed under edge responses"
```

---

### Task 4: Integrator docs + production checklist

**Files:**
- Create: `docs/BRIDGE-CONTRACT.md`
- Modify: `docs/PRODUCTION-CHECKLIST.md` (section 5)
- Modify: `docs/superpowers/specs/2026-07-28-live-webhook-bridge-design.md` (status + baseline)

- [ ] **Step 1: Write `docs/BRIDGE-CONTRACT.md`**

Required sections (keep under ~200 lines):

1. **Purpose** — external bridge for live discover/send/publish/health/rotate
2. **Logger vs bridge** table:

| Endpoint | Role |
|---|---|
| `POST /api/publish/webhook` | In-app delivery log only; blocked as live target by production-gate when host matches `APP_URL` |
| External / mock bridge | Real or simulated platform I/O; set as `SOCIAL_PUBLISH_WEBHOOK_URL` |

3. **Transport** — `POST`, `Authorization: Bearer`, `content-type: application/json`, `x-komenin-action`, `x-komenin-contract: v1`
4. **Actions** — table of request fields for all five actions (from spec §5)
5. **Success / error JSON** examples
6. **Empty discover** = HTTP 2xx + `posts: []` → app creates zero rows
7. **Local mock** commands (`npm run bridge:mock` + env including `ALLOW_SECURITY_STUBS=true`)
8. **Production** — different host than `APP_URL` for self-path; never enable stubs in production

- [ ] **Step 2: Extend production checklist**

In `docs/PRODUCTION-CHECKLIST.md` under **## 5. Social connectors (live)**, append:

```markdown
### Mock bridge (local verification)

```bash
MOCK_BRIDGE_TOKEN=dev-bridge-token-please-change npm run bridge:mock
```

```env
SIMULATOR_MODE=false
ALLOW_SECURITY_STUBS=true
SOCIAL_PUBLISH_WEBHOOK_URL=http://127.0.0.1:8787/bridge
SOCIAL_PUBLISH_WEBHOOK_TOKEN=dev-bridge-token-please-change
SOCIAL_CONNECTOR_POLICY=prefer_webhook
```

- [ ] Mock `/healthz` and `POST /bridge` respond
- [ ] Live poll against mock does not invent `example.com` filler posts outside mock fixtures
- [ ] Comment send / publish against mock return `externalId` prefixed `mock_`
- [ ] Read `docs/BRIDGE-CONTRACT.md` and `bridges/mock-social/README.md`
```

- [ ] **Step 3: Update design spec header**

In `docs/superpowers/specs/2026-07-28-live-webhook-bridge-design.md`:

- Set status to: `Approved — implementation plan docs/superpowers/plans/2026-07-28-live-webhook-bridge.md`
- In §3 baseline, state that contract module + webhook validation + self-webhook gate already shipped; remaining work is mock bridge + docs + client tests.

- [ ] **Step 4: Commit docs**

`docs/superpowers/` is gitignored — force-add when needed:

```bash
git add docs/BRIDGE-CONTRACT.md docs/PRODUCTION-CHECKLIST.md
git add -f docs/superpowers/specs/2026-07-28-live-webhook-bridge-design.md
git add -f docs/superpowers/plans/2026-07-28-live-webhook-bridge.md
git commit -m "docs: bridge contract runbook and mock checklist"
```

---

### Task 5: End-to-end verification

**Files:** none required (verification only)

- [ ] **Step 1: Targeted unit suite**

```bash
npx vitest run \
  tests/unit/bridge-contract.test.ts \
  tests/unit/mock-social-bridge.test.ts \
  tests/unit/webhook-connector.test.ts \
  tests/unit/live-readiness.test.ts \
  tests/unit/production-gate.test.ts
```

Expected: all PASS

- [ ] **Step 2: Full quality gates**

```bash
npm test
npm run lint
```

Expected: all tests pass; eslint zero warnings

- [ ] **Step 3: Optional build**

```bash
npx next build
```

Expected: exit 0 (if environment allows)

- [ ] **Step 4: Manual mock smoke** (if not completed in Task 2)

Start `bridge:mock`, curl discover + sendComment, confirm `mock_` ids.

- [ ] **Step 5: Hand off**

Do **not** implement in this plan:

- Real Instagram media-container / TikTok native publish
- SAML XMLDSig / SSO ticket single-use store
- Durable job queue / per-job cron redesign
- Settings UI “probe bridge now” button
- Production-gate live HTTP probe requirement

---

## Spec coverage self-review

| Spec requirement | Plan task |
|---|---|
| Contract module + parse rules | Already shipped; Task 3 locks client behavior |
| Webhook client fail-closed + `x-komenin-contract` | Shipped + Task 3 |
| Mock bridge 5 actions, token, separate port | Tasks 1–2 |
| Mock README + env wiring | Task 2 |
| Integrator docs + checklist | Task 4 |
| Self-webhook gate kept | Shipped; Task 5 re-runs readiness/gate tests |
| Empty discover / filter malformed posts | Tasks 1 & 3 |
| No auto-retry / no native API epic | Global constraints + Task 5 out-of-scope |
| Optional probe | Explicitly deferred |

## Placeholder scan

No TBD/TODO in steps; all code blocks are concrete.

## Type consistency

- Handler: `handleMockBridgeRequest`, `MockBridgeRequest`, `MockBridgeResponse`
- Server imports `./handler` and reuses those types
- Tests import handler via `../../bridges/mock-social/handler`
- Contract header string `"v1"` matches `BRIDGE_CONTRACT_VERSION` in app code
