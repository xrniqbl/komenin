# Aether

Enterprise social operations control plane for Instagram, Threads, and TikTok.

## Stack

- Next.js App Router + TypeScript + Tailwind v4
- Auth.js (Google)
- Prisma + Neon Postgres
- Coss / Base UI + shadcn
- Vitest + Testing Library
- Hybrid AI gateway (OpenAI-compatible, 9Router)

## Features

### Session Routing
- Multi-tunnel account grid with proxy pools (HTTP/SOCKS5, residential/mobile/datacenter)
- AES-256-GCM encrypted session vault with fingerprint & user-agent
- Health probes, IP rotation logs, account status (healthy/degraded/limited/banned)
- Route: `/app/accounts`, `/app/proxies`, `/app/sessions`

### Comment Engine
- Keyword / competitor / trend listeners with discovery polling
- AI-assisted contextual comment drafts (hybrid gateway: 9Router + local fallback)
- Approval-first workflow with bulk approve/reject (checkbox multi-select)
- Human-like pacing (configurable min/max delay), rate limits
- Routes: `/app/campaigns`, `/app/inbox`, `/app/approvals` (bulk), `/app/activity`

### Content Calendar v2
- Topic → N posts generation via AI gateway (batch JSON parsing + local fallback)
- Month / week / day calendar views with HTML5 drag-drop reschedule
- Interval scheduling (minutes/hours/days), bulk approve, publish due posts
- Routes: `/app/content`, `/app/content/[campaignId]` with `ContentCalendar`

### Reply Templates
- Reusable templates with `{{variables}}`: authorHandle, platform, goal, tone, postSnippet, agentName, workspaceName, topic
- Live preview with sample context, variable chips insertion, category grouping
- Integrated into comment generation (`templateBody` path)
- Routes: `/app/templates`, `/app/templates/new`, `/app/templates/[id]`

### Risk Scanner v2
- Built-in promo-claim detector: `gratis 100%`, `dijamin untung`, `100% berhasil`, `cuan instan`, `kaya cepat`, etc.
- Custom rules: banned phrase (substring) or JS regex literal `/pattern/flags`, configurable severity (low/medium/high)
- Composite scoring: high=0.4, medium=0.2, low=0.1, blocked if any high or score>=0.8
- Heuristics: excessive caps, spam keywords (`beli sekarang`, `klik disini`)
- RiskRules manager UI: enable/disable, create/delete, severity badge
- Integrated into `generateContextualCommentHybrid` — guardrail message when blocked
- Routes: `/app/settings/risk-rules`

### Agent Intelligence
- Agent persona: tone, language, system prompt, status
- Knowledge RAG: document ingestion → chunking (500 chars) → token overlap ranking
- Memory ledger: entityType + entityKey + fact + confidence
- Guardrails: `no_spam`, `max_sentences`, etc.
- Playground testing, active workspace scoping
- Routes: `/app/agents`, `/app/agents/[id]`

### Skill Execution
- Builtin skills: coupon lookup (AETHER10/GROW20), brand FAQ
- Webhook skills: POST `{skill, text}` + Bearer token, parse `text|message`
- Intent triggers: keyword patterns per skill
- CoT run timeline: ordinal steps persisted via SkillRunStep
- High-risk flag forces manual approval even in auto mode
- Routes: `/app/skills`, `/app/runs`

### Competitor Radar
- Track competitor handles per platform (Instagram/Threads/TikTok) with display name
- Auto-creates competitor listener (`type: competitor`) for discovery
- Metrics: 7d/30d post count, avg/day, daily buckets last 14d sparkline, top keywords (token freq)
- Comparison table: you vs all competitors volume 30d
- Route: `/app/competitors`

### External Notifications (Slack/Discord/Webhook)
- WebhookEndpoint model: name, url, secretEnc (Bearer), actions[] (event allowlist), isActive
- Events: `account.degraded`, `approval.timeout`, `comment.failed`, `content.failed`, `usage.warning`, `competitor.new_post`, `approval.new`, `campaign.completed`
- Formatters: Slack blocks, Discord embeds, generic JSON `{event,title,body,href,workspace,extra,timestamp,source:"aether"}`
- Auto-detect by URL substring, 10s timeout, typed logs to DeliveryLog
- Worker: `runNotifyDispatch` dispatches unread notifications + checks stale approvals >24h → notification + external event
- Health probe degraded also triggers `account.degraded` external via dispatcher
- Routes: `/app/settings/webhooks`

### Rate Limit Dashboard & Analytics
- Workspace monthly usage counters (periodKey `YYYY-MM`) + account daily quota
- QuotaMeter component: progress bar with color (ok=neutral, warning=amber 80%+, critical=red 100%+)
- RateLimitGrid: per-account cards with quota meter + throttled badge
- Analytics page: KPIs (sends, failures, pending approvals, publishes, healthy/degraded, skill runs) + delivery mix + quota meters + usage alerts
- Dedicated route: `/app/rate-limits` with workspace sends/publishes meters + account grid
- Usage warning alerts: 80% warning, 100% critical, stored as today deduped notifications via worker `usage.rollup`
- Routes: `/app/analytics`, `/app/rate-limits`

### API Keys & Public REST API
- `ApiKey` model: prefix (visible `aeth_...`), hashedKey SHA256 unique, scopes[], expiresAt, lastUsedAt, isActive
- Generation: `aeth_` + 48 hex chars, hash via SHA256, raw shown once with copy button + dismiss warning
- Scopes: `campaigns:read`, `campaigns:write`, `accounts:read`, `templates:read`, `activity:read`, `analytics:read`, `competitors:read`
- Server: `createApiKey`, `listApiKeys`, `revokeApiKey`, `deleteApiKey` with audit logs
- Auth middleware: reads `x-api-key` or `Authorization: Bearer aeth_...`, checks hashed match + expiry, updates lastUsedAt async
- Public endpoints (read-only v1):
  - `GET /api/v1/campaigns` — requires `campaigns:read`
  - `GET /api/v1/accounts` — requires `accounts:read`
  - `GET /api/v1/activity` — requires `activity:read`
  - `GET /api/v1/analytics` — requires `analytics:read`
- Route: `/app/settings/api-keys`

### Custom Roles & Fine-grained RBAC
- `CustomRole` model: workspaceId, name, slug, description, permissions[] (string[]), isSystem bool
- Membership extension: `customRoleId?` + relation to CustomRole + index
- RBAC lib: `can(role, perm)` + `canWithCustom(role, customPerms?, perm)` + `resolvePermissions` + `PERMISSION_DEFINITIONS` with label/group
- Base roles preserved: owner(10 perms), admin(7), operator(4), analyst(1), auditor(3), viewer(1)
- CRUD: create with slugify + valid perms filter + unique slug, update, delete with usage guard
- UI: checkbox grouped by category (Billing/Team/Accounts/Campaigns/Intelligence/Analytics/Audit/Settings), badge display, delete danger zone with member usage guard
- Routes: `/app/settings/roles`

### Status Page & Monitoring
- `getPublicStatus()`: queries last 24h JobRuns (success rate), SessionHealthChecks ok%, DeliveryLog groupBy kind last 24h, failed jobs 30d incidents, daily uptime buckets 30d from JobRuns
- Public page `/status`: overall uptime 30d + sparkline bars (green/yellow/red), worker success 24h, health probes 24h, services table (Web App/Table/Worker/Session Probes/Delivery stats), incident history list, link to `/api/status`
- Public JSON API `/api/status` (no auth, safe for UptimeRobot/BetterStack): `{ok, checkedAt, uptime, services, counts}`
- Env signals section retained for deployment region, DB, auth, encryption, worker secret, live connector
- Routes: `/status`, `/api/status`

### Search & Filter
- `FilterBar` client component: debounced search (300ms) + status/platform Select filters via URL query params (`q`, `status`, `platform`), clear all
- Supported on: `/app/campaigns`, `/app/accounts`, `/app/content`, `/app/audit-logs`, `/app/templates`

### Marketing & Docs
- Rich feature detail pages: `/features/session-routing`, `/features/comment-engine`, `/features/agent-intelligence`, `/features/skill-execution`
  - Hero with stats (proxy protocols, approval modes, knowledge RAG, etc), icon badges, CTAs
  - Capabilities 4-card grid with Lucide icons (Shield, Zap, Bot, Workflow...)
  - Architecture flow (3 steps with boxes + arrows)
  - Why-it-matters + Security & control card + Final CTA dark band
  - Mock previews: SessionRoutingMock (tunnel grid), CommentEngineMock (approval queue cards), AgentIntelligenceMock (knowledge chips + RAG grounded), SkillExecutionMock (registry + runs + CoT timeline)
  - Uses existing tokens: rounded-2xl, border, muted bg, Badge secondary/outline
- Other marketing: About, Contact, Enterprise, Security, Pricing (comparison rows), Status, Legal (privacy/terms/aup)
- Docs: `/docs`, `/docs/tutorial/*`, `/docs/api/*` with article/pager/search/sidebar/top-nav components

## Setup

1. Create a Neon Postgres database and set `DATABASE_URL`
2. Create a Google Cloud OAuth web client with redirect:
   - `http://localhost:3000/api/auth/callback/google`
3. Copy `.env.example` to `.env.local` and fill:
   - `AUTH_SECRET`
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `ENCRYPTION_KEY` (64 hex chars)
   - `SIMULATOR_MODE=true` (default)
   - `WORKER_SECRET` (for `/api/worker/run`)
4. Install and prepare database:

```powershell
npm install
npx prisma generate
npx prisma db push
npm run dev
```

5. Open:
- `/` marketing site
- `/signup` Google auth
- `/onboarding` workspace creation
- `/app` command center

## Routes — App side

- `/app` — overview (workspace metrics + quick links)
- `/app/accounts`, `/app/proxies`, `/app/sessions` — Session Routing
- `/app/campaigns`, `/app/content`, `/app/templates` — Automation + Content Calendar v2 with drag-drop + Templates
- `/app/listeners`, `/app/inbox`, `/app/approvals` (bulk select), `/app/activity` — Comment Engine
- `/app/agents`, `/app/skills`, `/app/runs`, `/app/competitors` — Intelligence + Competitor Radar
- `/app/analytics`, `/app/rate-limits`, `/app/audit-logs`, `/app/notifications` — Workspace insights
- `/app/settings/*` — general/team/ai/risk-rules/publisher/webhooks/api-keys/roles/billing/security

## Routes — Public API

- `GET /api/v1/campaigns` — header `x-api-key: aeth_...` + scope `campaigns:read`
- `GET /api/v1/accounts` — scope `accounts:read`
- `GET /api/v1/activity` — scope `activity:read`
- `GET /api/v1/analytics` — scope `analytics:read`
- `GET /api/status` — public uptime/health (no auth)

## Worker jobs

Simulator-friendly jobs:

```powershell
npm run worker:tick
npm run worker:health
npm run worker:poll
npm run worker:generate
npm run worker:send
npm run worker:content-generate
npm run worker:content-publish
npm run worker:knowledge
npm run worker:skills
npm run worker:usage
npm run worker:notify
```

Or HTTP:

```powershell
curl -X POST http://localhost:3000/api/worker/run `
  -H "Authorization: Bearer $env:WORKER_SECRET" `
  -H "Content-Type: application/json" `
  -d '{"job":"worker.tick"}'
```

Jobs:
- `session.health_check` — probes accounts + IP + session, writes SessionHealthCheck + DeliveryLog, creates notification + external webhook `account.degraded` on degrade
- `proxy.rotate` — rotates non-sticky assignments, writes IpRotationLog
- `listener.poll` — discoverPosts via connector (simulator returns 3 synthetic), creates TargetPost(new) + DeliveryLog
- `comment.generate` — loads agent knowledge chunks (50 ready) + skill triggers, runs first matched skill, calls `generateContextualCommentHybrid` with knowledge+skill+riskRules context
- `comment.send` — checks monthlySendLimit, calls sendComment via connector, updates actions + draft + post, bumps UsageCounter.sends, external notify on fail
- `content.generate` — topic → batch posts via AI gateway, builds schedule, replaces drafts txn
- `content.publish` — monthlyPublishLimit check, publishSocialPost via connectorPolicy, bumps UsageCounter.publishes
- `knowledge.ingest` — chunkText + tokenize per doc, replaces KnowledgeChunk, ready/failed
- `skill.execute` — runs pending SkillRun via runtime
- `usage.rollup` — upserts UsageCounter for all active workspaces + dispatches usage warnings (80%/100%) deduped daily
- `notify.dispatch` — dispatches external for unread notifications (maps titles to events) + checks stale approvals >24h → notification + `approval.timeout` external
- `worker.tick` — `Promise.allSettled` of all 11 jobs, combined ok/message/details

## Billing (Midtrans Snap)

- Checkout: `/app/checkout`
- Billing settings: `/app/settings/billing`
- Admin commerce: `/admin/billing`, `/admin/vouchers`
- Webhook: `POST /api/billing/midtrans/notification`
- Env: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`

Without Midtrans keys, checkout uses local simulation and marks orders paid via `/app/checkout/result?sim=1`.
- Free voucher (total 0) path: order marked paid immediately as `voucher_free` without calling Midtrans Snap

## Admin panel

Promote a user:

```sql
UPDATE "User" SET "platformRole" = 'superadmin' WHERE email = 'you@example.com';
```

Then open `/admin`.

## SSO / multi-region

- Workspace SSO: `/app/settings/security`
- SAML login bootstrap: `/api/auth/sso/saml/login?email=user@domain.com`
- ACS: `/api/auth/sso/saml/acs`
- Region metadata: `AETHER_REGION`, workspace `homeRegion`, `/admin/regions`

## Hybrid AI gateway

Aether remains a social-ops control plane. Draft generation can route through any OpenAI-compatible gateway (including 9Router):

Campaign/Agent -> Aether AI Router (tiered fallback) -> 9Router/OpenAI-compatible endpoint -> local rule-based fallback

Env:
- `AI_GATEWAY_BASE_URL=http://localhost:20128/v1`
- `AI_MODEL_PRIMARY=...`
- `AI_MODEL_FALLBACKS=model-a,model-b`
- or `AI_PROVIDERS` JSON for multi-tier providers

Settings UI: `/app/settings/ai`

## 9Router-only mode — recommended

1. Connect providers (xAI/Grok, Claude, etc.) inside 9Router using build auth
2. Point Aether only to 9Router:

```
AI_GATEWAY_ENABLED=true
AI_GATEWAY_BASE_URL=http://localhost:20128/v1
AI_GATEWAY_API_KEY=
AI_MODEL_PRIMARY=grok-4
AI_MODEL_FALLBACKS=grok-3-mini
```

Do not put xAI keys in Aether when using 9Router build auth.

## Security

- Encrypted secrets at rest with `ENCRYPTION_KEY` + key versioning
- AES-256-GCM `v1:iv:tag:cipher` format
- RBAC: owner/admin/operator/analyst/auditor/viewer + custom roles (compose PERMISSION_DEFINITIONS)
- `assertCan` guards + new `canWithCustom`/`resolvePermissions`
- `.env.example` uses placeholders only (real secrets scrubbed)
- `middleware.ts` → `proxy.ts` migration for Next.js 16
- Middleware / proxy convention deprecation fixed
- `publish-delivery-log.ts` FS-safe for serverless (try/catch ENOENT/EROFS)

## Testing

```powershell
npm run test
npm run test:watch
```

- 40 original tests + new: `template-engine.test.ts`, `risk-scanner.test.ts`, `quota.test.ts`, `api-keys.test.ts`, `content-calendar-utils.test.ts`
- Sidebar test expanded to assert new nav items: Templates, Competitor Radar, Rate Limits

## File Map (highlights of new features)

- `src/lib/template-engine.ts` — `TEMPLATE_VARIABLES`, `parseVariables`, `renderTemplate`, `sampleRenderContext`, `countVariableUsages`
- `src/lib/risk-scanner.ts` — `DEFAULT_BANNED`, `PROMO_CLAIM_PATTERNS`, `scanContentRisk`, scoring high/medium/low, regex custom rules
- `src/lib/content-calendar-utils.ts` — `getMonthMatrix`, `getWeekDays`, `dateKey`, `isSameDay`, `formatCalTitle`, `addMonths`, `addDays`, `combineDateAndTime`
- `src/lib/api-keys.ts` — `generateApiKey`, `hashApiKey`, `isValidScope`, `SCOPES`
- `src/lib/api-auth.ts` — `authenticateApiKey`, `hasScope`, `requireScope`
- `src/lib/quota.ts` — `getThresholdStatus`, `getQuotaPercent`, `quotaColor`, `formatQuota`
- `src/lib/notify/channels.ts` — `NotificationEvent`, `EVENT_LABELS`, `ALL_EVENTS`, `eventColor`
- `src/lib/notify/formatters.ts` — `formatSlackPayload`, `formatDiscordEmbed`, `formatGeneric`, `detectFormatter`
- `src/lib/notify/dispatcher.ts` — `dispatchExternal`, `dispatchForUnreadNotifications`
- `src/server/templates.ts` — CRUD templates, variables auto-parsed, usageCount
- `src/server/risk-rules.ts` — CRUD risk rules with audit logs
- `src/server/competitors.ts` — `CompetitorProfile` CRUD + auto listener + metrics 7d/30d/avg/dayBuckets/topKeywords + overview
- `src/server/webhooks.ts` — CRUD webhook endpoints + test dispatch
- `src/server/rate-limits.ts` — `listRateLimitStatus` (accounts pct/throttled, workspace sends/publishes pct/status)
- `src/server/usage-alerts.ts` — `checkUsageAlerts`, `dispatchUsageWarningsForAllWorkspaces` deduped daily
- `src/server/api-keys.ts` — CRUD api keys, hashed storage, raw once, scopes validation, audit logs
- `src/server/custom-roles.ts` — CRUD custom roles with slugify + perms validation + member usage guard
- `src/server/status.ts` — `getPublicStatus()`: 24h success rate, health rate, delivery mix, 30d uptime buckets, incidents from failed jobs
- `src/lib/rbac.ts` — extended with `PERMISSION_DEFINITIONS`, `canWithCustom`, `resolvePermissions`
- `src/app/app/templates/*` — list + new + [id] with editors
- `src/app/app/competitors/page.tsx` — radar overview + competitor cards
- `src/app/app/rate-limits/page.tsx` — workspace meters + account grid
- `src/app/app/settings/*` — risk-rules, webhooks, api-keys, roles pages + managers
- `src/app/api/v1/*` — public REST with api key auth
- `src/app/api/status/route.ts` — public health JSON
- `src/app/(marketing)/status/page.tsx` — enriched with uptime sparkline + incidents + /api/status link
- `src/components/marketing/feature-demo-mocks.tsx` — SessionRoutingMock/CommentEngineMock/AgentIntelligenceMock/SkillExecutionMock
- `src/components/marketing/feature-detail-page.tsx` — hero + stats + capabilities + architecture + security + CTA
- `src/components/content/content-calendar.tsx` — month/week/day views, drag-drop reschedule, unscheduled bucket, legend
- `src/components/approvals/approvals-queue-client.tsx` — select-all checkbox + bulk note + bulk approve/reject + alert
- `src/components/approvals/approval-card.tsx` — individual approve/reject with editable draft + notes
- `src/components/app/filter-bar.tsx` — debounced search + status/platform filters via URL searchParams
- `src/components/templates/template-editor.tsx` — textarea + variable chips + detected badges + live preview
- `src/components/settings/*` — risk-rules-manager, api-keys-manager, roles-manager, webhooks-manager
- `src/components/analytics/*` — quota-meter, rate-limit-grid
- `src/components/competitors/*` — competitors-client + competitor-card
- `prisma/schema.prisma` — new models: RiskRule, RiskScanLog, CommentTemplate, CompetitorProfile, ApiKey, CustomRole; Membership customRoleId relation
