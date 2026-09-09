# Komenin (Lokarouter)

Social media automation platform for Instagram, Threads, and TikTok —
discovery, AI comment drafting with approval flows, scheduled publishing,
leads, and agency multi-client management. **Domain: [komenin.id](https://komenin.id)**

**Stack:** Next.js (App Router) · TypeScript · Prisma + PostgreSQL ·
NextAuth · Midtrans billing · Vitest

## Modules

| Area | Path | What it does |
|---|---|---|
| Campaigns | `src/app/app/campaigns` | Multi-platform campaign config (limits, delays, approval mode) |
| Listeners & discovery | `src/app/app/listeners` | Keyword polling → target posts (live via bridge, never invented) |
| Approvals & inbox | `src/app/app/approvals`, `inbox` | Human-in-the-loop review before any send |
| Content publishing | `src/app/app/content` | Drafts, schedules, publisher settings |
| Agents & AI | `src/app/app/agents` | AI providers, prompts, skill execution |
| Leads & clients | `src/app/app/leads`, `clients` | Lead capture + agency client workspaces |
| Sessions & proxies | `src/app/app/sessions`, `proxies` | Account session health, proxy rotation |
| Analytics & activity | `src/app/app/analytics`, `activity`, `runs` | Metrics and audit trails |
| Public REST API | `src/app/api/v1` | API-key scoped: accounts, activity, analytics, campaigns, leads, listeners |
| Admin | `src/app/admin` | SSO policy, vouchers, platform admin |
| Billing | `src/app/api/billing` | Midtrans Snap + voucher redemption |

Live social I/O (discover / comment / publish / health / rotate) is delegated
to an **external bridge** implementing the versioned contract — see
[docs/BRIDGE-CONTRACT.md](docs/BRIDGE-CONTRACT.md). An in-repo mock bridge
(`npm run bridge:mock`) implements the same contract for local verification.

## Quick start

```bash
npm install
cp .env.example .env.local        # fill DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY…
npx prisma generate
npx prisma migrate deploy         # JANGAN pakai db:push di database produksi
npm run dev                       # http://localhost:3000
```

Workers (scheduled jobs — suruh aplikasi memanggil /api/worker/cron dengan
CRON_SECRET; di Vercel via vercel.json crons, di Docker via service `cron`
di docker-compose.yml):

```bash
npm run worker            # bridge client worker process (bukan queue runner)
npm run worker:dev        # sama, mode watch

# Jalankan satu job sekali-dari-terminal:
npx tsx scripts/run-worker.ts <job-name>   # mis. worker.tick / comment.send
```

Local live-mode verification against the mock bridge:

```bash
MOCK_BRIDGE_TOKEN=dev-bridge-token-please-change npm run bridge:mock
# then in .env.local: SIMULATOR_MODE=false, ALLOW_SECURITY_STUBS=true,
# SOCIAL_PUBLISH_WEBHOOK_URL=http://127.0.0.1:8787/bridge
```

## Verification gates

```bash
npx tsc --noEmit   # types
npm test           # 232 unit/integration tests
npm run lint       # eslint --max-warnings 0
npm run build      # production build
```

## Deployment

- **Docker / self-hosted:** `docker compose up -d` (see [docs/deploy/DEPLOYMENT-GUIDE.md](docs/deploy/DEPLOYMENT-GUIDE.md))
- **Vercel:** import repo, set env vars from `.env.example`, add Postgres (Neon)
- **Before going live:** walk [docs/PRODUCTION-CHECKLIST.md](docs/PRODUCTION-CHECKLIST.md) — runtime gates fail closed in production when secrets or the external bridge URL are misconfigured

## Docs

Index: [docs/README.md](docs/README.md) — architecture ADRs, security audit,
testing/monitoring strategy, integrator guides, bridge contract.
