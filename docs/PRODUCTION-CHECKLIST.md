# Aether production go-live checklist

Use this before promoting a deploy out of simulator / foundation mode.

## 1. Runtime hard gates

These fail closed via `evaluateProductionGate()` when `NODE_ENV=production`:

| Check | Required value |
|---|---|
| `SIMULATOR_MODE` | `false` |
| `WORKER_SECRET` | set (min 16 chars) |
| `SOCIAL_PUBLISH_WEBHOOK_TOKEN` | set when simulator is off |
| Midtrans keys | required if `MIDTRANS_IS_PRODUCTION=true` |

Also required by env schema:

- `DATABASE_URL`
- `AUTH_SECRET` (min 16; use 32+)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- `APP_URL` (public HTTPS origin)
- `ENCRYPTION_KEY` (64 hex chars)

Recommended:

- `AUTH_URL` == `APP_URL`
- `ALLOW_SECURITY_STUBS=false`
- `AETHER_REGION` set

## 2. Database

```bash
npm run db:migrate:deploy
npm run db:migrate:status
```

Confirm:

- [ ] Prisma migrations applied
- [ ] Plans seed via `ensureBillingCatalog()` on first checkout/billing visit
- [ ] Regions available in admin

## 3. Bootstrap first superadmin

Admin routes require `User.platformRole = superadmin`.

One-time SQL (replace email):

```sql
UPDATE "User"
SET "platformRole" = 'superadmin'
WHERE email = 'you@company.com';
```

Or promote from `/admin/users` once one superadmin already exists.

Checklist:

- [ ] At least one superadmin can open `/admin`
- [ ] Non-admin user is redirected to `/app`
- [ ] Create a test voucher at `/admin/vouchers`
- [ ] Validate voucher on `/app/checkout`

## 4. Billing / Midtrans

Sandbox first:

```env
MIDTRANS_IS_PRODUCTION="false"
MIDTRANS_SERVER_KEY="SB-Mid-server-..."
MIDTRANS_CLIENT_KEY="SB-Mid-client-..."
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION="false"
```

Production:

```env
MIDTRANS_IS_PRODUCTION="true"
MIDTRANS_SERVER_KEY="Mid-server-..."
MIDTRANS_CLIENT_KEY="Mid-client-..."
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION="true"
```

Checklist:

- [ ] Snap token creation works
- [ ] Notification webhook `/api/billing/midtrans/notification` reachable
- [ ] Paid order activates subscription
- [ ] 100% voucher free order settles without Midtrans
- [ ] Amount signature / gross amount binding verified

Without `MIDTRANS_SERVER_KEY`, checkout returns `isSimulation: true` (not live money).

## 5. Social connectors (live)

```env
SIMULATOR_MODE="false"
SOCIAL_PUBLISH_WEBHOOK_URL="https://your-worker-or-bridge/..."
SOCIAL_PUBLISH_WEBHOOK_TOKEN="long-random"
SOCIAL_CONNECTOR_POLICY="prefer_webhook" # or prefer_official
```

Official OAuth (as needed):

- Instagram: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`
- Threads: `THREADS_APP_ID`, `THREADS_APP_SECRET`
- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

Checklist:

- [ ] Connect account flow works for target platforms
- [ ] Session import / reimport works
- [ ] Health check worker marks healthy/degraded correctly
- [ ] Comment send + content publish leave simulator payloads
- [ ] Approvals queue can approve and dispatch

Notes:

- Threads/TikTok native actions may still fall back to webhook.
- Marketing mocks are intentional demo UI only and never seed product tables.

## 6. Worker process

Run separately from the web process:

```bash
npm run worker
# or tick-specific:
npm run worker:tick
npm run worker:health
npm run worker:poll
npm run worker:generate
npm run worker:send
```

Checklist:

- [ ] Worker authenticates with `WORKER_SECRET`
- [ ] Job runs appear in `/admin/jobs`
- [ ] Failed jobs are visible and actionable
- [ ] Notify / usage rollup jobs scheduled in your orchestrator

## 7. AI providers

Either:

1. Workspace UI: **Settings → AI** (preferred), or
2. Env bootstrap:

```env
AI_GATEWAY_ENABLED="true"
AI_GATEWAY_BASE_URL="https://..."
AI_GATEWAY_API_KEY="..."
AI_MODEL_PRIMARY="..."
```

Checklist:

- [ ] Provider credentials encrypted at rest
- [ ] Agent generation works on a real campaign
- [ ] Fallback model path tested

## 8. Auth / SSO

- [ ] Google OAuth callback on production domain
- [ ] Invite accept flow works
- [ ] Workspace switcher scopes correctly
- [ ] SSO only enabled after SAML signature validation is production-ready  
  (`SAML_ALLOW_UNSIGNED` / security stubs must stay off in prod)

## 9. Security smoke

```bash
npm run smoke:security
```

Checklist:

- [ ] No open publish webhook without token
- [ ] Security stubs disabled
- [ ] Encryption key stable (rotation plan documented)
- [ ] Rate limits enabled on public billing/auth endpoints

## 10. Functional smoke (no dummy data)

Product lists are empty until real records exist. That is expected.

Walkthrough:

1. Sign up / login
2. Create or join workspace
3. Connect account + proxy + session
4. Create campaign + listener/template
5. Generate comment → approval → send
6. Create content campaign → publish
7. Open analytics (real counters only)
8. Checkout with/without voucher
9. Admin overview shows real counts

## 11. Deploy topology (recommended)

| Process | Command |
|---|---|
| Web | `npm run build && npm run start` |
| Worker | `npm run worker` (always-on or cron per job) |
| DB | managed Postgres |
| Secrets | platform secret manager |

Do **not** ship with:

- `SIMULATOR_MODE=true`
- empty Midtrans keys while advertising paid checkout
- unsigned SAML stubs
- shared `ENCRYPTION_KEY` across unrelated environments without re-encrypt plan

## 12. Definition of “production ready”

Aether is production-ready when all of the following are true:

- [ ] Production gate returns `ok: true`
- [ ] Simulator mode is off and no simulator payloads appear in deliveries
- [ ] Billing money path works (or deliberately free/voucher-only)
- [ ] Worker is healthy and processing jobs
- [ ] Superadmin can manage workspaces, users, vouchers, flags
- [ ] No product UI is backed by hardcoded demo rows
- [ ] Incident path exists (audit logs + job failures + alerts)
