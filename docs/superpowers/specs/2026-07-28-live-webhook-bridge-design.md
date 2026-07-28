# Aether Live Webhook Bridge Design

**Date:** 2026-07-28  
**Status:** Approved for planning (pending user review of this file)  
**Product:** Aether (repo: lokarouter)  
**Epic type:** Harden & complete existing live social delivery (not net-new product features)  
**Decision locked:** Webhook-bridge end-to-end as the production live path; native platform APIs remain secondary/optional

---

## 1. Summary

Make Aether’s **live** social path honest and operable by:

1. Formalizing a **versioned external bridge contract** for connector actions.
2. Hardening the app’s webhook client so invalid or empty bridge responses cannot look like success.
3. Shipping an **in-repo mock bridge** (separate from the delivery-log endpoint) for local/CI verification.
4. Keeping operator surfaces (readiness, production gate, docs) aligned with reality: self-`/api/publish/webhook` is a logger, not a social bridge.

This epic completes existing Session Routing / Comment Engine / Content Publish live plumbing. It does **not** add CRM, SSO, or full native IG/TikTok media APIs.

---

## 2. Goals & non-goals

### Goals

- Operator can set `SIMULATOR_MODE=false` + external `SOCIAL_PUBLISH_WEBHOOK_URL` + token and get real discover / send / publish behavior through a bridge that implements the contract.
- Mock bridge in-repo runs locally and satisfies the contract for all five connector actions.
- Live mode never invents `example.com` (or any synthetic) target posts.
- HTTP 200 with invalid shape cannot mark comment/publish as sent.
- Production gate and live readiness refuse self-hosted app logger URL as “live ready.”
- Docs and settings copy state clearly: logger ≠ bridge.

### Non-goals

- Completing Instagram Graph media-container publish, full TikTok publish/comment, or making official APIs the primary path.
- Production SAML/SSO signature validation.
- New product modules (deeper CRM, new automation modes, etc.).
- Guaranteeing platform ToS compliance or undetectability.
- Durable multi-region job queue rewrite (worker reliability may be a follow-up epic).
- Automatic multi-retry storms inside the webhook client (v1).

---

## 3. Current baseline (context)

Already in tree (as of 2026-07-28 hardening):

- Connector router: simulator / webhook / official policy.
- `runWebhookConnector` POSTs action payloads to `SOCIAL_PUBLISH_WEBHOOK_URL` with optional Bearer token.
- `executeSocialAction` resolves workspace OAuth vault credentials for official path.
- Live listener poll / manual poll no longer invent sample posts.
- Production gate + live readiness block self-`APP_URL` + `/api/publish/webhook`.
- App route `POST /api/publish/webhook` only appends a delivery log and returns a synthetic id — **not** a social network.

Gaps this epic closes:

- No formal, versioned response validation on bridge replies.
- No runnable mock bridge that implements discover/send/publish/health/rotate.
- Operator docs still easy to misread as “point webhook at yourself = live.”
- Optional fields / empty discover success vs failure not fully specified for integrators.

---

## 4. Architecture

```text
Aether app (workers / server actions)
  -> connector router (policy + runtime mode)
       -> webhook client (contract v1 request)
            -> EXTERNAL bridge URL (real or mock)
                 <- contract v1 response (validated)
       -> official adapters (optional, unchanged primary path)
       -> simulator (SIMULATOR_MODE=true)

NOT a live bridge:
  POST /api/publish/webhook  (delivery log only)
```

### Topology rules

| Component | Host | Role |
|---|---|---|
| Aether web + `/api/worker/*` | App deploy | Control plane + job entry |
| External / mock bridge | **Different origin** than `APP_URL` in production live | Performs or simulates platform I/O |
| `/api/publish/webhook` | App | Dev delivery log; never production-live target |

Production-gate already errors if live webhook URL is same host as `APP_URL` and path is `/api/publish/webhook`. This epic keeps that invariant and documents it in the bridge pack.

---

## 5. Bridge contract v1

### Transport

- **Method:** `POST`
- **URL:** single endpoint (`SOCIAL_PUBLISH_WEBHOOK_URL`); action discriminated by body `action` and header `x-aether-action`
- **Auth:** `Authorization: Bearer <SOCIAL_PUBLISH_WEBHOOK_TOKEN>` (required when `SIMULATOR_MODE=false`)
- **Content-Type:** `application/json`
- **Contract header (request + response):** `x-aether-contract: v1`
- **Timeout:** use existing safe outbound fetch limits; no connector-level multi-retry in v1

### Common request envelope

```json
{
  "action": "discoverPosts | sendComment | publishPost | healthProbe | rotateProxy",
  "platform": "instagram | threads | tiktok | string",
  "username": "string | null",
  "accountId": "string | null",
  "workspaceId": "string | null",
  "idempotencyKey": "string | null"
}
```

`idempotencyKey` is **optional** in v1. Bridges may dedupe on it; the app may send it later but must not require it for acceptance.

Action-specific fields (aligned with current `src/lib/connectors/webhook.ts` emitters):

| Action | Extra request fields |
|---|---|
| `discoverPosts` | `query`, `limit`, `listenerId` |
| `sendComment` | `body`, `targetPostExternalId`, `targetPostUrl`, `authorHandle` |
| `publishPost` | `title`, `body`, `hashtags`, `caption`, `scheduledFor`, `publishedAt`, `workspaceId` |
| `healthProbe` | `hasSession`, `proxyHealthy` |
| `rotateProxy` | `proxyId`, `seed` |

### Common success response

HTTP **2xx** only when the operation is accepted/completed per bridge semantics.

```json
{
  "ok": true,
  "message": "string",
  "externalId": "string | optional",
  "posts": [ /* discover only */ ],
  "healthy": true,
  "ip": "string | optional",
  "details": {}
}
```

### Common error response

HTTP **4xx/5xx** or HTTP 2xx with `ok: false` (app treats both as failure; prefer non-2xx for transport errors, `ok: false` body optional).

```json
{
  "ok": false,
  "error": "string",
  "message": "string"
}
```

### Per-action response requirements (app validation)

| Action | Success requires |
|---|---|
| `discoverPosts` | `ok !== false`; `posts` is either omitted/empty array **or** array of valid posts. **Empty array is success** (no invent). Each present post must have non-empty `externalId`, `authorHandle`, `content`, `url`, `platform`. **Invalid items are filtered out**; if the bridge returned a non-array `posts`, fail the call. |
| `sendComment` | Success only if HTTP 2xx and parseable body does not set `ok: false`. Prefer non-empty `externalId` / `externalPostId` / `id`; if missing, still allow success but record warning in `details` (bridge should send id). |
| `publishPost` | Same as sendComment; caption/body already sent by app. |
| `healthProbe` | HTTP 2xx; `healthy` boolean if present, else infer `healthy: true` only on 2xx without `ok: false`. |
| `rotateProxy` | HTTP 2xx; `ip` optional string. |

### App-side validation rules (normative)

1. Non-2xx → `ConnectorResult.ok = false` with status + message (existing behavior, keep).
2. 2xx + JSON with `ok: false` → fail.
3. 2xx + non-JSON body → fail (“invalid bridge response”).
4. `discoverPosts`: if `posts` key exists and is not an array → fail. If array, map only structurally valid posts; do not invent fillers.
5. Never treat app delivery-log synthetic ids as proof of platform delivery in live mode documentation.

Aliases accepted on success ids (existing): `externalId` | `externalPostId` | `id`.

---

## 6. Components

### 6.1 Contract module (app)

**Path (planned):** `src/lib/connectors/bridge-contract.ts` (name flexible in plan)

- Types + parse/validate helpers for bridge responses per action.
- Optional request helpers to attach `x-aether-contract: v1`.
- Pure functions, unit-tested; no I/O.

### 6.2 Webhook client hardening

**Path:** `src/lib/connectors/webhook.ts`

- After `safeOutboundFetch`, run contract validation before returning `ok: true`.
- Preserve SSRF protections.
- On validation failure: `ok: false`, `message` starts with clear prefix e.g. `Invalid bridge response`.
- Send header `x-aether-contract: v1` on requests.

### 6.3 Mock bridge (in-repo)

**Path (planned):** `bridges/mock-social/` or `scripts/mock-social-bridge/`

- Small Node HTTP server (or `tsx` script) implementing all five actions.
- Auth: Bearer token from env `MOCK_BRIDGE_TOKEN` (or accept same token as docs example).
- Deterministic fixtures:
  - `discoverPosts` → 1–N valid posts (fixture handles derived from query).
  - `sendComment` / `publishPost` → return stable fake `externalId` prefixed `mock_`.
  - `healthProbe` → `{ healthy: true }`.
  - `rotateProxy` → `{ ip: "203.0.113.10" }` (TEST-NET).
- **Must not** be deployed as `APP_URL` route; run on separate port (e.g. `8787`).
- README: how to point `.env.local` at `http://127.0.0.1:8787/...`.

Clarify vs existing logger:

| Endpoint | Purpose |
|---|---|
| `POST /api/publish/webhook` | In-app delivery log for demos; blocked as live target by gate |
| Mock bridge process | Contract-compatible stand-in for an external worker |

### 6.4 Readiness & production gate

**Paths:** `src/lib/runtime-mode.ts`, `src/lib/production-gate.ts`

- Keep self-URL detection.
- Document `CRON_SECRET` / worker requirements remain orthogonal.
- **Bridge HTTP probe is optional (not required for v1 done).** If implemented later: non-blocking warning on failure, or separate operator button — not a hard gate unless product asks.

### 6.5 Operator docs

- Update `docs/PRODUCTION-CHECKLIST.md` (already partially updated) with mock bridge runbook.
- Short bridge integrator section: headers, actions, examples, empty discover semantics.
- Settings/publisher copy if it still implies self-webhook is live (plan may touch UI strings only if misleading today).

### 6.6 Workers

No change to “no invent in live” rules beyond ensuring webhook validation errors surface in DeliveryLog / notifications the same as connector failures. `billing.expire` and other jobs are out of this epic’s feature scope (already shipped separately).

---

## 7. Data flow

### Happy path (live + external/mock bridge)

1. Job or action calls `executeSocialAction` / `publishSocialPost`.
2. Router selects webhook under live + prefer_webhook (or webhook_only).
3. Client POSTs contract v1 body + Bearer + `x-aether-contract: v1`.
4. Bridge returns 2xx + valid JSON.
5. Client validates → `ConnectorResult.ok = true`.
6. Worker persists posts / marks sent / stores `externalId`.
7. DeliveryLog: `connector=webhook`, `mode=live`, payload notes `invented: false` where applicable.

### Empty discover

1. Bridge returns `{ posts: [] }` or omits posts with ok success.
2. Worker creates **zero** `targetPost` rows.
3. Not an error unless bridge returned non-2xx or invalid shape.

### Failure path

1. Validation or HTTP failure → `ok: false`.
2. Comment send stays failed / not marked sent.
3. Listener poll notifies on hard failure (existing live behavior).

---

## 8. Error handling & security

- **SSRF:** continue `safeOutboundFetch` / URL safety; localhost mock allowed only in non-production per existing allowlist rules — if localhost is blocked in some envs, document using `127.0.0.1` exceptions already used for dev stubs **or** run mock only where outbound localhost is permitted. Plan must verify current `url-safety` localhost policy and align mock instructions (use whatever the codebase already allows for dev).
- **Auth:** live requires token; mock requires token.
- **No secret leakage** in bridge error messages back to clients beyond safe connector message strings.
- **Idempotency:** optional key only; double-send risk accepted at worker tick level unless bridge dedupes.
- **Retries:** none automatic in webhook client v1 (avoid duplicate comments).

---

## 9. Testing

| Layer | What |
|---|---|
| Unit | Contract parse: valid posts, invalid posts array type, ok:false body, missing JSON |
| Unit | Webhook client with mocked fetch: 200 valid, 200 invalid, 500, empty discover |
| Unit | Production gate / live readiness self-URL (existing + keep green) |
| Smoke | Mock bridge handler functions or scripted curl against mock server |
| Out of scope | Real Instagram/TikTok login E2E |

Success criteria checklist:

- [ ] Live discover never creates synthetic example.com posts
- [ ] Invalid bridge 200 cannot mark comment/publish sent
- [ ] Mock bridge serves all five actions under contract v1
- [ ] Gate/readiness refuse self publish webhook URL
- [ ] Docs describe external bridge vs delivery log
- [ ] Automated tests cover validation + fail-closed client

---

## 10. Rollout plan (implementation phases)

1. **Contract module + tests**
2. **Webhook client validation + header**
3. **Mock bridge package/script + README**
4. **Docs / checklist / any misleading UI copy**
5. **Optional:** manual bridge probe in settings (not required for epic close)

Deploy note: app can ship validation before mock; mock is for integrator confidence. Production still needs a **real** bridge host for true platform I/O.

---

## 11. Open points resolved in this design

| Question | Decision |
|---|---|
| Primary live path | External webhook bridge |
| In-repo deliverable | Spec + mock bridge (not full production platform worker) |
| Self `/api/publish/webhook` | Logger only; gate blocks as live target |
| Empty discover | Success with zero rows |
| Malformed posts in array | Filter invalid items; non-array `posts` fails |
| Bridge HTTP probe in readiness | Not required for v1 |
| Native API completion | Out of scope |
| Connector auto-retry | None in v1 |

---

## 12. Follow-ups (explicitly later)

- Real production bridge implementation outside mock (customer infra or separate service).
- Official Graph media publish completion + token refresh job.
- Durable queue / per-job cron splitting for heavy live load.
- SAML XMLDSig.
- Stricter sendComment requiring `externalId` (breaking for loose bridges).

---

## 13. Approval record

| Section | Outcome |
|---|---|
| Goal & scope | Approved |
| Architecture & contract | Approved |
| Components, failures, testing | Approved — write spec |
| Approach | **A — Live Delivery Hardening** |

**Next step after user approves this file:** invoke **writing-plans** to produce `docs/superpowers/plans/2026-07-28-live-webhook-bridge.md` (or dated equivalent). No implementation coding until that plan exists and is accepted.
