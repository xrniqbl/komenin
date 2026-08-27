# Aether Social Bridge Contract (v1)

External bridge contract for live social actions: discover, comment, publish,
health, and proxy rotation. Any HTTP service implementing this contract can act
as Aether's live connector backend.

## Purpose

Aether never talks to social platforms directly in live mode. It posts JSON
actions to an external **bridge** (`SOCIAL_PUBLISH_WEBHOOK_URL`). The bridge
performs the real platform I/O (or simulates it, like the in-repo mock) and
returns contract-v1 JSON.

## Logger vs bridge

| Endpoint | Role |
|---|---|
| `POST /api/publish/webhook` (this app) | In-app delivery **log only**. Never a live target — production-gate fails closed when `SOCIAL_PUBLISH_WEBHOOK_URL` host matches `APP_URL` |
| External bridge / mock bridge | Real or simulated platform I/O. Set as `SOCIAL_PUBLISH_WEBHOOK_URL` |

## Transport

- Method: `POST`
- Auth: `Authorization: Bearer <SOCIAL_PUBLISH_WEBHOOK_TOKEN>` (required)
- Content type: `application/json`
- Action header: `x-komenin-action: <action>`
- Contract header: `x-komenin-contract: v1` (required on request; recommended on response)

## Actions

| Action | Request fields | Success fields |
|---|---|---|
| `discoverPosts` | `platform`, `query`, `limit` (1–100), `username?`, `accountId?`, `workspaceId?`, `listenerId?` | `ok`, `posts[]` |
| `sendComment` | `platform`, `body`, `targetPostExternalId?`, `targetPostUrl?`, `authorHandle?` | `ok`, `externalId` |
| `publishPost` | `platform`, `title?`, `body`, `hashtags[]`, `caption` (pre-joined), `scheduledFor?` | `ok`, `externalId` |
| `healthProbe` | `platform`, `hasSession`, `proxyHealthy` | `ok`, `healthy` |
| `rotateProxy` | `platform`, `proxyId?`, `seed?` | `ok`, `ip` |

### Post shape (`discoverPosts`)

Each item in `posts[]` must have all five fields or it is **dropped**:

```json
{ "externalId": "ig_123", "authorHandle": "@brand", "content": "text", "url": "https://...", "platform": "instagram" }
```

## Success / error responses

Success (HTTP 2xx):

```json
{ "ok": true, "externalId": "comment_987", "message": "Comment accepted" }
```

Empty discover is a **success** (HTTP 2xx + `posts: []`). The app creates zero
target-post rows — it never invents filler posts.

Error (any status, or 2xx with `ok: false`):

```json
{ "ok": false, "error": "upstream rate limited" }
```

The app fails closed on: non-2xx status, `ok: false`, non-JSON body, non-array
`posts`, or missing required fields. No connector-level retry (avoids double
comments).

## Local mock bridge

```bash
# terminal 1 — start the mock (contract v1, all five actions)
MOCK_BRIDGE_TOKEN=dev-bridge-token-please-change npm run bridge:mock
```

Point the app at it (`.env.local`):

```env
SIMULATOR_MODE=false
ALLOW_SECURITY_STUBS=true   # required so safeOutboundFetch allows 127.0.0.1 (never in production)
SOCIAL_PUBLISH_WEBHOOK_URL=http://127.0.0.1:8787/bridge
SOCIAL_PUBLISH_WEBHOOK_TOKEN=dev-bridge-token-please-change
SOCIAL_CONNECTOR_POLICY=prefer_webhook
```

Smoke:

```bash
curl -sS -X POST http://127.0.0.1:8787/bridge \
  -H "authorization: Bearer dev-bridge-token-please-change" \
  -H "content-type: application/json" \
  -d '{"action":"discoverPosts","platform":"instagram","query":"kopi","limit":2}'
```

Mock ids are prefixed `mock_`. See `bridges/mock-social/README.md`.

## Production

- Bridge host **must differ** from `APP_URL` (self-path is blocked by `evaluateProductionGate()`).
- Never set `ALLOW_SECURITY_STUBS=true` in production.
- Use a long random `SOCIAL_PUBLISH_WEBHOOK_TOKEN`; rotate per environment.
