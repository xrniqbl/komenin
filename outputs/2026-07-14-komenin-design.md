# Komenin Design Spec

**Date:** 2026-07-14  
**Status:** Draft for user review  
**  
**Product type:** Multi-tenant B2B SaaS control plane for managed social engagement operations

---

## 1. Summary

Komenin is an enterprise SaaS platform that helps growth teams and agencies operate many social accounts safely and intelligently across Instagram, Threads, and TikTok.

It combines four product pillars:

1. **Session Routing** — proxy/IP rotation, anti-detect session vault, multi-tunnel account grid
2. **Comment Automation Engine** — listeners, contextual AI comments, human-like pacing, approvals
3. **Agent Intelligence** — persona, guardrails, RAG knowledge base, long-term memory
4. **Skill Execution** — function calling, intent auto-triggers, Chain-of-Thought run logs

The product is **fully managed cloud**, **hybrid go-to-market** (self-serve + enterprise), and built as a **modular Next.js monolith** with Untitled UI, Neon Postgres, and Google OAuth.

---

## 2. Goals & Non-Goals

### Goals
- Give operators a clean command center for hundreds of social tunnels
- Keep automation controllable (approval modes, quotas, auditability)
- Make AI comments contextual using business knowledge, not spam templates
- Allow agents to execute approved skills and show reasoning trails
- Support enterprise needs: workspaces, RBAC, billing/usage, audit logs

### Non-Goals (v1)
- Guarantee undetectability or ToS circumvention
- Full custom Linux script sandbox for arbitrary remote code
- SSO/SAML (post-MVP)
- Public multi-region active-active infra
- Consumer social scheduling suite (this is ops automation, not Buffer clone)

### Positioning / compliance stance
Frame as **managed social engagement operations** with guardrails, not a spam farm. Default campaign mode is human approval. Acceptable Use Policy is first-class.

---

## 3. Target Users & GTM

### Primary segment
SaaS B2B enterprise and serious growth teams / agencies.

### Personas
- **Owner / Admin** — billing, team, integrations, policy
- **Operator** — accounts, campaigns, approvals, day-to-day execution
- **Analyst** — performance and reporting
- **Auditor** — immutable activity review / export
- **Viewer** — read-only stakeholder access

### Go-to-market
Hybrid:
- Self-serve: Google signup → create workspace → invite team → paid plans
- Enterprise: custom quota, security review path, sales demo, later SSO

### Platforms in MVP scope
- Instagram
- Threads
- TikTok

Depth of connector automation may ship progressively, but **data model + UI are multi-platform from day one**.

---

## 4. Architecture

### Recommended approach
**Modular monolith (approved):**

- Next.js App Router web app + API
- Untitled UI component system
- Neon Postgres + Prisma
- Auth.js / NextAuth with Google provider
- Background jobs via Inngest or BullMQ
- Object storage for knowledge uploads
- App-level encryption for secrets
- pgvector for RAG embeddings

### Why not split services first
Faster product surface delivery (marketing + app + admin). Session/campaign workers can later extract into an automation plane without redesigning IA/UI.

### Runtime diagram

```text
Browser (Untitled UI)
  -> Next.js (RSC + Server Actions + Route Handlers)
    -> Neon (tenancy, configs, drafts, audit)
    -> Encrypted secret fields
    -> Object storage (docs)
    -> Job queue workers
      -> session health / proxy rotate
      -> listeners
      -> comment generate/send
      -> knowledge ingest
      -> skill execute
```

### Multi-tenancy
Shared database, hard `workspace_id` isolation on business tables. All app queries scoped to active workspace membership.

---

## 5. Information Architecture & Page Map

### 5.1 Public marketing

| Route | Page |
|---|---|
| `/` | Landing |
| `/features` | Features overview |
| `/features/session-routing` | Session Routing feature |
| `/features/comment-engine` | Comment Engine feature |
| `/features/agent-intelligence` | Agent Intelligence feature |
| `/features/skill-execution` | Skill Execution feature |
| `/pricing` | Pricing |
| `/enterprise` | Enterprise |
| `/security` | Security & compliance |
| `/customers` | Customers / use cases |
| `/changelog` | Changelog |
| `/docs` | Docs hub |
| `/contact` | Contact / book demo |
| `/about` | About |
| `/legal/privacy` | Privacy |
| `/legal/terms` | Terms |
| `/legal/aup` | Acceptable Use Policy |
| `/status` | Status (optional v1.1) |

#### Landing sections
1. Sticky nav + CTAs
2. Hero thesis
3. Trust / logo bar
4. Four product pillars
5. Product UI mock (accounts grid + CoT)
6. How it works
7. Security & control
8. Pricing teaser
9. Enterprise CTA
10. FAQ
11. Footer

### 5.2 Auth & onboarding

| Route | Page |
|---|---|
| `/login` | Login (Google) |
| `/signup` | Signup (Google) |
| `/auth/error` | Auth error |
| `/onboarding` | Workspace onboarding wizard |
| `/invite/[token]` | Accept invite |

#### Onboarding steps
1. Create workspace
2. Invite teammates (skippable)
3. Select platforms
4. Connect first account or add proxy
5. Choose starter agent persona
6. Enter `/app`

### 5.3 App (authenticated)

Base path: `/app/*`

#### Overview
- `/app` Command Center
- `/app/notifications` Notification center

#### Session Routing
- `/app/accounts`
- `/app/accounts/new`
- `/app/accounts/[accountId]`
- `/app/proxies`
- `/app/proxies/new`
- `/app/proxies/[proxyId]`
- `/app/sessions`
- `/app/sessions/[sessionId]`

#### Comment Automation
- `/app/campaigns`
- `/app/campaigns/new`
- `/app/campaigns/[campaignId]`
- `/app/campaigns/[campaignId]/edit`
- `/app/listeners`
- `/app/listeners/new`
- `/app/inbox`
- `/app/approvals`
- `/app/activity`

#### Agent Intelligence
- `/app/agents`
- `/app/agents/new`
- `/app/agents/[agentId]`
- `/app/agents/[agentId]/persona`
- `/app/agents/[agentId]/knowledge`
- `/app/agents/[agentId]/memory`
- `/app/agents/[agentId]/playground`

#### Skill Execution
- `/app/skills`
- `/app/skills/new`
- `/app/skills/[skillId]`
- `/app/skills/[skillId]/edit`
- `/app/runs`
- `/app/runs/[runId]`
- `/app/triggers`

#### Insights & settings
- `/app/analytics`
- `/app/audit-logs`
- `/app/settings`
- `/app/settings/general`
- `/app/settings/team`
- `/app/settings/roles`
- `/app/settings/billing`
- `/app/settings/usage`
- `/app/settings/integrations`
- `/app/settings/api-keys`
- `/app/settings/security`
- `/app/settings/danger`

### 5.4 Platform admin

- `/admin`
- `/admin/workspaces`
- `/admin/workspaces/[id]`
- `/admin/users`
- `/admin/providers`
- `/admin/jobs`
- `/admin/flags`
- `/admin/system`

### 5.5 App sidebar IA

```text
Command Center
Session Routing
  Accounts
  Proxies
  Sessions
Automation
  Campaigns
  Listeners
  Inbox
  Approvals
  Activity
Intelligence
  Agents
  Skills
  Runs (CoT)
Insights
  Analytics
  Audit Logs
Settings
```

---

## 6. Visual Design System

### Direction
**Quiet Control Plane** — calm, precise, premium enterprise ops UI. Light-first, dark secondary.

### Color tokens
| Token | Hex | Use |
|---|---|---|
| `ink-950` | `#0B1220` | Primary text / dark base |
| `ink-700` | `#334155` | Secondary text |
| `ink-500` | `#64748B` | Muted text |
| `canvas` | `#F7F8FA` | App background |
| `surface` | `#FFFFFF` | Cards/panels |
| `line` | `#E6EAF0` | Borders |
| `brand-600` | `#0F766E` | Primary CTA |
| `brand-500` | `#14B8A6` | Accent/hover |
| `brand-50` | `#F0FDFA` | Soft wash |
| `signal-ok` | `#12B76A` | Healthy |
| `signal-warn` | `#F79009` | Degraded |
| `signal-danger` | `#F04438` | Failed/banned |
| `signal-info` | `#2E90FA` | Running/syncing |

### Typography
- Marketing display: Satoshi or Geist
- App UI/body: Inter
- Mono/data: JetBrains Mono or Geist Mono

### Layout
- Marketing max width ~1200–1280px, airy sections
- App shell: collapsible sidebar + topbar + page header + content
- Detail-heavy flows use right drawers
- Signature pattern: **Signal Rail** on operational rows/cards

### Component priorities
1. Multi-tunnel accounts DataGrid
2. Campaign stepper
3. Approvals split inbox
4. CoT timeline
5. Knowledge upload + indexing states
6. Clean enterprise settings/billing

### Motion
Subtle, purposeful, 150–200ms. No noisy gradients/parallax/confetti.

---

## 7. Roles & Permissions

### Workspace roles
`owner | admin | operator | analyst | auditor | viewer`

### Matrix (v1)
| Capability | owner | admin | operator | analyst | auditor | viewer |
|---|---|---|---|---|---|---|
| Billing | yes | no | no | no | no | no |
| Members/roles | yes | yes | no | no | no | no |
| Accounts/proxies | yes | yes | yes | no | no | no |
| Campaigns/approvals | yes | yes | yes | no | no | no |
| Agents/knowledge | yes | yes | yes | no | no | no |
| Skills/triggers | yes | yes | limited | no | no | no |
| Analytics | yes | yes | yes | yes | yes | yes |
| Audit view/export | yes | yes | no | no | yes | no |

---

## 8. Data Model (Neon)

### Tenancy rules
- Business rows include `workspace_id`
- Secrets encrypted at rest with key versioning
- Soft delete for critical entities
- Audit logs append-only
- Platform superadmin separate from workspace roles

### Core entities
- Identity: `users`, auth tables, `workspaces`, `memberships`, `invites`
- Billing: `plans`, `subscriptions`, `usage_counters`, optional `invoices`
- Session routing: `social_accounts`, `account_sessions`, `proxy_endpoints`, `proxy_assignments`, `ip_rotation_logs`, `session_health_checks`
- Automation: `campaigns`, `campaign_accounts`, `listeners`, `target_posts`, `comment_drafts`, `comment_actions`, `approvals`, `behavior_profiles`
- Intelligence: `agents`, `agent_guardrails`, `knowledge_documents`, `knowledge_chunks`, `memory_entries`, `agent_versions`
- Skills: `skills`, `skill_versions`, `skill_triggers`, `skill_runs`, `skill_run_steps`, `skill_permissions`
- Ops: `audit_logs`, `notifications`, `job_runs`, `api_keys`, `webhook_endpoints`, `feature_flags`

### Important enums / statuses
- Platforms: `instagram | threads | tiktok`
- Account status: `draft | connecting | healthy | degraded | limited | banned | archived`
- Campaign mode: `draft | approval_required | auto`
- Campaign status: `draft | active | paused | completed | failed`
- Skill executor: `builtin | webhook` (script sandbox later)

### Indexing
Hot indexes on workspace-scoped status/time queries; pgvector ANN for chunks. Partition high-volume logs later if needed.

---

## 9. Module Flows

### 9.1 Session Routing
Connect account → encrypt session → fingerprint/UA → bind proxy → health probe → grid visibility.  
Support proxy packs, rotate policies, reconnect queue, health sweeps.

### 9.2 Comment Engine
Create campaign → listeners → healthy accounts → agent → behavior limits → mode.  
Worker: discover posts → generate draft → optional skill → approval/auto path → delayed send → action log.  
Default mode: `approval_required`.

Human-like controls:
- daily caps
- random delay
- health gating
- dedupe targets
- backoff on rate limits

### 9.3 Agent Intelligence
Create persona + guardrails.  
Ingest docs/URLs → chunk → embed → retrieve on generation.  
Memory ledger stores durable facts per platform entity/handle.  
Playground tests drafts without publishing.

### 9.4 Skill Execution
Register skill (builtin/webhook) with schema + permissions.  
Intent recognition matches triggers → policy checks → run + CoT steps → inject result into reply.  
High-risk skills can force approval even in auto campaigns.  
No arbitrary shell execution in MVP.

### Golden path demo
Google login → workspace → proxies → accounts → agent knowledge → coupon skill → competitor campaign (approval mode) → draft+skill CoT → approve → paced send → analytics/audit trail.

---

## 10. Jobs / Workers (MVP)

| Job | Purpose |
|---|---|
| `session.health_check` | Probe account/session health |
| `proxy.rotate` | Rotate IP by policy |
| `listener.poll` | Discover target posts |
| `comment.generate` | Build contextual drafts |
| `comment.send` | Execute approved/auto sends |
| `knowledge.ingest` | Parse/chunk/embed docs |
| `skill.execute` | Run tools + CoT |
| `usage.rollup` | Aggregate quotas |
| `notify.dispatch` | In-app notifications |

---

## 11. Tech Stack Decisions

| Layer | Choice |
|---|---|
| UI kit bootstrap | `npx untitledui@latest init` |
| Framework | Next.js App Router + TypeScript |
| Styling | Tailwind + Untitled UI tokens |
| Auth | Auth.js + Google Cloud OAuth |
| DB | Neon Postgres |
| ORM | Prisma |
| Vectors | pgvector |
| Jobs | Inngest (preferred DX) or BullMQ |
| File uploads | S3-compatible storage |
| Validation | Zod |
| Tables | Untitled table primitives + virtualization where needed |
| Payments | Stripe for self-serve; manual/enterprise overrides |

---

## 12. Implementation Phases

### Phase 0 — Foundation
- Repo init (Next + Untitled UI)
- Design tokens
- Auth Google
- Neon + Prisma baseline
- Workspace/membership model
- App shell + marketing shell

### Phase 1 — Marketing + access
- Landing + feature pages + pricing/enterprise/security/legal
- Login/signup/onboarding/invite
- Settings team/billing skeleton

### Phase 2 — Session Routing
- Accounts grid
- Proxy manager
- Session vault + health
- Rotation logs

### Phase 3 — Comment Engine
- Campaigns + listeners
- Draft generation pipeline (can start mocked)
- Approvals inbox
- Activity log
- Behavior limits

### Phase 4 — Agent Intelligence
- Agents CRUD
- Persona/guardrails
- Knowledge upload + RAG
- Memory ledger basic
- Playground

### Phase 5 — Skills + CoT
- Skill registry
- Builtin coupon skill
- Triggers
- Runs timeline UI
- Wire into comment generation path

### Phase 6 — Enterprise hardening
- Audit export
- Usage enforcement
- Admin console
- Stronger observability
- Security pass

---

## 13. MVP Acceptance Criteria

### Product
- User can sign in with Google and create a workspace
- Team invite + role assignment works
- Operator can add proxy and connect social account records
- Accounts grid shows status/IP/health
- Campaign can be created in approval mode
- AI draft appears in approvals with edit/approve/reject
- Agent can use uploaded document context in draft
- At least one skill runs with visible CoT steps
- Audit log captures sensitive actions

### UX
- Clean light enterprise aesthetic with teal brand accents
- Untitled UI consistency across marketing and app
- Empty/error states always offer next action

### Safety
- Default approval mode on
- Quotas and delays enforced before send
- Secrets never stored plaintext
- AUP/legal pages present

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Platform ToS / ban risk | Approval defaults, rate limits, AUP, health gating |
| Over-scoped MVP | Phase delivery; mock connectors early if needed |
| Secret leakage | encryption, redaction in logs, least-privilege roles |
| Worker complexity | start with one queue system + clear job names |
| RAG quality weak | playground + citations + chunk status visibility |
| Enterprise trust gap | security page, audit logs, RBAC, export |

---

## 15. Open Items (non-blocking)

- Final product name: Komenin
- Exact job system choice: Inngest vs BullMQ
- Stripe plan packaging numbers
- Whether memory ships in first vertical slice or immediately after RAG
- Depth of real platform connectors vs simulated adapters in earliest build

---

## 16. Approved Decisions Log

| Decision | Choice |
|---|---|
| Segment | B2B enterprise |
| GTM | Hybrid self-serve + enterprise |
| Platforms | Instagram + Threads + TikTok |
| Runtime | Fully managed cloud |
| Architecture | Modular Next.js monolith |
| UI system | Untitled UI |
| Database | Neon |
| Auth | Google OAuth |
| Visual direction | Quiet Control Plane (clean, teal, light-first) |
| Default automation mode | `approval_required` |
| Page map | Approved (Section 1) |
| Design system | Approved (Section 2) |
| Data model | Approved (Section 3) |
| Module flows | Approved (Section 4) |

---

## 17. Next Step After Spec Approval

Create implementation plan under `docs/superpowers/plans/` covering:

1. Bootstrap Next.js + Untitled UI
2. Neon schema + Auth.js Google
3. Marketing pages
4. App shell + RBAC
5. Module vertical slices in phase order

Execution can then proceed task-by-task with review checkpoints.
