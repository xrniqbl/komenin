# Komenin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap Komenin as a working Next.js + Untitled UI product with Google auth, Neon multi-tenant workspace model, marketing site, onboarding, and authenticated app shell.

**Architecture:** Modular Next.js App Router monolith. Marketing routes are public. Auth uses Auth.js (NextAuth v5) with Google. Business data is workspace-scoped in Neon via Prisma. App shell under `/app` is membership-gated. Later module plans build Session Routing, Comment Engine, Agents, and Skills on this foundation.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Untitled UI, Auth.js + Google OAuth, Prisma, Neon Postgres, Zod, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-07-14-komenin-design.md`

**Scope note:** Full product has 4 automation subsystems. This plan delivers Phase 0-1 only (foundation + marketing + access). Follow-on plans:
- `2026-07-14-komenin-session-routing.md`
- `2026-07-14-komenin-comment-engine.md`
- `2026-07-14-komenin-agent-intelligence.md`
- `2026-07-14-komenin-skill-execution.md`

---

## File Structure (this plan)

```text
src/
  app/
    (marketing)/ layout.tsx, page.tsx, features/*, pricing, enterprise, security, contact, about, legal/*
    (auth)/ login, signup, auth/error
    onboarding/page.tsx
    invite/[token]/page.tsx
    app/ layout.tsx, page.tsx, settings/*, notifications/page.tsx
    api/auth/[...nextauth]/route.ts
  components/marketing/*, components/app/*
  lib/ auth.ts, auth.config.ts, db.ts, env.ts, rbac.ts, workspace.ts, encryption.ts
  server/ workspaces.ts, memberships.ts, invites.ts, audit.ts
  types/ next-auth.d.ts, workspace.ts
prisma/schema.prisma
tests/unit/*, tests/components/*
```

---

### Task 1: Initialize Git + Next.js + Untitled UI

**Files:**
- Create: project root scaffold via CLI

- [ ] **Step 1: Initialize git repository**

Run:
```powershell
git init
```
Expected: `.git` directory created

- [ ] **Step 2: Scaffold Next.js app**

```powershell
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```
If non-empty dir blocks scaffolding, temporarily move `docs` and `outputs`, scaffold, restore.
Expected: `package.json`, `src/app`, `tsconfig.json`

- [ ] **Step 3: Initialize Untitled UI**

```powershell
npx untitledui@latest init --yes
```
Choose Next.js App Router + TypeScript + existing Tailwind + `src/`.

- [ ] **Step 4: Install dependencies**

```powershell
npm install next-auth@beta @auth/prisma-adapter prisma @prisma/client zod
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event tsx
```

- [ ] **Step 5: Add scripts**

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "prisma generate",
  "db:push": "prisma db push",
  "db:studio": "prisma studio"
}
```

- [ ] **Step 6: Create vitest.config.ts and vitest.setup.ts**

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Commit**

```powershell
git add .
git commit -m "chore: bootstrap next.js, untitled ui, and test tooling"
```

---

### Task 2: Environment validation + design tokens

**Files:**
- Create: `src/lib/env.ts`, `.env.example`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create `src/lib/env.ts`**

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ENCRYPTION_KEY: z.string().length(64),
});

export function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
```

- [ ] **Step 2: Create `.env.example`**

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
APP_URL="http://localhost:3000"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

- [ ] **Step 3: Add Quiet Control Plane CSS tokens to `src/app/globals.css`**

```css
:root {
  --ink-950: #0b1220;
  --ink-700: #334155;
  --ink-500: #64748b;
  --canvas: #f7f8fa;
  --surface: #ffffff;
  --line: #e6eaf0;
  --brand-600: #0f766e;
  --brand-500: #14b8a6;
  --brand-50: #f0fdfa;
  --signal-ok: #12b76a;
  --signal-warn: #f79009;
  --signal-danger: #f04438;
  --signal-info: #2e90fa;
  --background: var(--canvas);
  --foreground: var(--ink-950);
  --primary: var(--brand-600);
  --primary-foreground: #ffffff;
  --border: var(--line);
  --card: var(--surface);
}
body { background: var(--background); color: var(--foreground); }
```

- [ ] **Step 4: Commit**

```powershell
git add src/lib/env.ts .env.example src/app/globals.css
git commit -m "feat: add env validation and quiet control plane tokens"
```

---

### Task 3: Prisma schema for foundation tenancy

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `src/types/workspace.ts`

- [ ] **Step 1: Write Prisma schema**

Create `prisma/schema.prisma` with:
- Auth.js models: `User`, `Account`, `Session`, `VerificationToken`
- Tenant models: `Workspace`, `Membership`, `Invite`, `AuditLog`
- Enums: `WorkspaceRole` (`owner|admin|operator|analyst|auditor|viewer`), `MembershipStatus`, `WorkspaceStatus`
- Unique membership on `[workspaceId, userId]`
- Indexes on `memberships.userId`, `invites(workspaceId,email)`, `audit_logs(workspaceId, createdAt desc)`

Use the exact schema from design spec Section 3 foundation entities.

- [ ] **Step 2: Create Prisma client singleton `src/lib/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 3: Create `src/types/workspace.ts`**

```ts
export type WorkspaceRole =
  | "owner"
  | "admin"
  | "operator"
  | "analyst"
  | "auditor"
  | "viewer";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};
```

- [ ] **Step 4: Generate client**

```powershell
npx prisma generate
```
Expected: Prisma Client generated

- [ ] **Step 5: Push schema when Neon ready**

```powershell
npx prisma db push
```

- [ ] **Step 6: Commit**

```powershell
git add prisma/schema.prisma src/lib/db.ts src/types/workspace.ts
git commit -m "feat: add neon foundation schema for workspaces and rbac"
```

---

### Task 4: RBAC + slug + encryption utilities (TDD)

**Files:**
- Create: `src/lib/rbac.ts`, `src/lib/workspace.ts`, `src/lib/encryption.ts`
- Create: `tests/unit/rbac.test.ts`, `tests/unit/workspace-slug.test.ts`, `tests/unit/encryption.test.ts`

- [ ] **Step 1: Write failing RBAC tests**

```ts
import { describe, expect, it } from "vitest";
import { can } from "@/lib/rbac";

describe("can", () => {
  it("allows owner to manage billing", () => {
    expect(can("owner", "billing.manage")).toBe(true);
  });
  it("denies operator billing management", () => {
    expect(can("operator", "billing.manage")).toBe(false);
  });
  it("allows operator to manage campaigns", () => {
    expect(can("operator", "campaigns.manage")).toBe(true);
  });
  it("allows auditor to view audit logs", () => {
    expect(can("auditor", "audit.view")).toBe(true);
    expect(can("viewer", "audit.view")).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/unit/rbac.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implement `src/lib/rbac.ts`**

Permissions:
`billing.manage`, `members.manage`, `accounts.manage`, `campaigns.manage`, `agents.manage`, `skills.manage`, `analytics.view`, `audit.view`, `audit.export`, `settings.manage`

Role matrix must match design spec:
- owner: all
- admin: all except billing
- operator: accounts/campaigns/agents/skills/analytics
- analyst: analytics
- auditor: analytics + audit view/export
- viewer: analytics

Export `can(role, permission)` and `assertCan(role, permission)`.

- [ ] **Step 4: Re-run RBAC tests**

Expected: PASS

- [ ] **Step 5: Write slug tests + implement `src/lib/workspace.ts`**

```ts
export function slugifyWorkspaceName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildUniqueSlugCandidate(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  return `${base}-${attempt + 1}`.slice(0, 48);
}
```

Tests:
- `Acme Growth` -> `acme-growth`
- strips invalid chars

- [ ] **Step 6: Write encryption tests + implement AES-GCM helpers**

`encryptSecret` / `decryptSecret` using `ENCRYPTION_KEY` 64-hex, payload format:
`v1:{ivHex}:{tagHex}:{cipherHex}`

- [ ] **Step 7: Run all unit tests**

```powershell
npm test -- tests/unit
```
Expected: PASS

- [ ] **Step 8: Commit**

```powershell
git add src/lib/rbac.ts src/lib/workspace.ts src/lib/encryption.ts tests/unit
git commit -m "feat: add rbac, slug, and secret encryption utilities"
```

---

### Task 5: Auth.js Google + route guards

**Files:**
- Create: `src/lib/auth.config.ts`, `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`, `src/middleware.ts`

- [ ] **Step 1: Create auth config with Google provider**

Pages: signIn `/login`, error `/auth/error`
Session strategy: `database`
`trustHost: true`

- [ ] **Step 2: Create `src/lib/auth.ts` with PrismaAdapter**

Callbacks:
- session includes `session.user.id`
Events:
- update `lastLoginAt` on signIn

Export `{ handlers, auth, signIn, signOut }`.

- [ ] **Step 3: Route handler**

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Session typing in `src/types/next-auth.d.ts`**

- [ ] **Step 5: Middleware protect `/app`, `/onboarding`; bounce authed users from `/login` `/signup`**

If database-session middleware is unstable, use server layout guards instead.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/auth.ts src/lib/auth.config.ts src/app/api/auth src/types/next-auth.d.ts src/middleware.ts
git commit -m "feat: add google auth with prisma adapter and route guards"
```

---

### Task 6: Workspace server actions

**Files:**
- Create: `src/server/audit.ts`, `src/server/workspaces.ts`, `src/server/memberships.ts`, `src/server/invites.ts`

- [ ] **Step 1: Implement `writeAuditLog`**

Fields: workspaceId, actorUserId, action, resourceType, resourceId, ip, metadata.

- [ ] **Step 2: Implement workspace list/create**

`listWorkspacesForUser()`:
- requires auth
- returns active memberships with workspace summary `{id,name,slug,role}`

`createWorkspace({ name, timezone? })`:
- validates name length >= 2
- slugify + unique candidate loop
- transaction: create workspace + owner membership
- write audit `workspace.created`

- [ ] **Step 3: Implement membership helpers**

`getActiveMembership(workspaceId)`
`requireMembership(workspaceId, minimumRoles?)`

- [ ] **Step 4: Implement invites**

`createInvite({ workspaceId, email, role })`:
- require membership + `members.manage`
- generate random token, store sha256 hash
- expires in 7 days
- return `{ inviteId, token }`
- audit `invite.created`

`acceptInvite(token)`:
- require session email match
- reject expired/used
- upsert membership
- mark accepted
- audit `invite.accepted`

- [ ] **Step 5: Commit**

```powershell
git add src/server
git commit -m "feat: add workspace membership invite and audit server actions"
```

---

### Task 7: Marketing shell + landing page

**Files:**
- Create: `src/components/marketing/*`
- Create: `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/page.tsx`
- Create: `tests/components/hero-section.test.tsx`

- [ ] **Step 1: Write hero test**

Assert heading:
`Operate social engagement with enterprise control`
and CTA link `Start free` -> `/signup`.

- [ ] **Step 2: Implement marketing components**

Required components:
- `site-header.tsx` (Features, Pricing, Enterprise, Security, Login, Start free)
- `site-footer.tsx` (Product/Company/Legal links)
- `hero-section.tsx` (thesis + product mock grid)
- `pillars-section.tsx` (4 pillars)
- `how-it-works-section.tsx`
- `security-section.tsx`
- `pricing-teaser-section.tsx`
- `faq-section.tsx`
- `cta-band.tsx`

Visual rules: light canvas, teal primary, generous whitespace, no neon cyber look.

- [ ] **Step 3: Wire marketing layout and home page**

Ensure `/` uses marketing group.

- [ ] **Step 4: Run hero test**

```powershell
npm test -- tests/components/hero-section.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/components/marketing "src/app/(marketing)" tests/components/hero-section.test.tsx
git commit -m "feat: add marketing shell and landing page"
```

---

### Task 8: Remaining marketing pages

**Files:**
- Create pages under `src/app/(marketing)/...`

- [ ] **Step 1: Create pages**

Routes:
- `/features`
- `/features/session-routing`
- `/features/comment-engine`
- `/features/agent-intelligence`
- `/features/skill-execution`
- `/pricing` (Starter $99, Growth $399, Enterprise Custom)
- `/enterprise`
- `/security`
- `/contact` (form UI + local success state)
- `/about`
- `/legal/privacy`
- `/legal/terms`
- `/legal/aup`

Each feature page: title, summary, 3-5 bullets, CTA.

- [ ] **Step 2: Build check**

```powershell
npm run build
```
Expected: compile success for marketing routes

- [ ] **Step 3: Commit**

```powershell
git add "src/app/(marketing)"
git commit -m "feat: add remaining marketing product and legal pages"
```

---

### Task 9: Auth pages + onboarding wizard

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `auth/error/page.tsx`
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/invite/[token]/page.tsx`

- [ ] **Step 1: Login/signup pages with Google server action**

```ts
await signIn("google", { redirectTo: "/onboarding" });
```
Button label: `Continue with Google`.

- [ ] **Step 2: Auth error page**

Show error from search params + link to login.

- [ ] **Step 3: Onboarding wizard**

Server checks:
- no session -> `/login`
- has workspace -> `/app`

Steps:
1. Workspace name + timezone (`Asia/Jakarta` default)
2. Optional invite emails
3. Platform multi-select: Instagram, Threads, TikTok
4. Submit createWorkspace + optional invites + redirect `/app`

- [ ] **Step 4: Invite accept page**

Call `acceptInvite(token)` then redirect `/app`.
Clear errors for expired/mismatch.

- [ ] **Step 5: Manual route check**

```powershell
npm run dev
```
Verify login page renders and unauth `/app` redirects.

- [ ] **Step 6: Commit**

```powershell
git add "src/app/(auth)" src/app/onboarding src/app/invite
git commit -m "feat: add google auth pages and workspace onboarding"
```

---

### Task 10: Authenticated app shell + command center skeleton

**Files:**
- Create: `src/components/app/*`, `src/app/app/**`, `tests/components/app-sidebar.test.tsx`

- [ ] **Step 1: Sidebar test**

Assert nav groups: Command Center, Session Routing, Automation, Intelligence.

- [ ] **Step 2: Implement sidebar IA exactly**

```ts
export const APP_NAV = [
  { label: "Command Center", href: "/app" },
  {
    label: "Session Routing",
    children: [
      { label: "Accounts", href: "/app/accounts" },
      { label: "Proxies", href: "/app/proxies" },
      { label: "Sessions", href: "/app/sessions" },
    ],
  },
  {
    label: "Automation",
    children: [
      { label: "Campaigns", href: "/app/campaigns" },
      { label: "Listeners", href: "/app/listeners" },
      { label: "Inbox", href: "/app/inbox" },
      { label: "Approvals", href: "/app/approvals" },
      { label: "Activity", href: "/app/activity" },
    ],
  },
  {
    label: "Intelligence",
    children: [
      { label: "Agents", href: "/app/agents" },
      { label: "Skills", href: "/app/skills" },
      { label: "Runs", href: "/app/runs" },
    ],
  },
  {
    label: "Insights",
    children: [
      { label: "Analytics", href: "/app/analytics" },
      { label: "Audit Logs", href: "/app/audit-logs" },
    ],
  },
  { label: "Settings", href: "/app/settings" },
];
```

- [ ] **Step 3: App layout gate**

1. auth required
2. list workspaces
3. empty -> onboarding
4. render sidebar + topbar + children
5. active workspace = first membership (v1)

- [ ] **Step 4: Command center**

Metric cards: Healthy accounts, Active campaigns, Pending approvals, Skill runs today.
CTA cards to accounts/campaigns/agents.

- [ ] **Step 5: Settings skeleton**

- `/app/settings`
- `/app/settings/general`
- `/app/settings/team` (members + invite form for owner/admin)
- `/app/settings/billing` (placeholder plan)

Invite form shows `/invite/{token}` in development panel.

- [ ] **Step 6: Notifications placeholder**

Empty state: `No notifications yet`.

- [ ] **Step 7: Verify**

```powershell
npm test
npm run build
```
Expected: PASS + build success

- [ ] **Step 8: Commit**

```powershell
git add src/components/app src/app/app tests/components/app-sidebar.test.tsx
git commit -m "feat: add authenticated app shell and command center skeleton"
```

---

### Task 11: README + final verification

**Files:**
- Create/Modify: `README.md`

- [ ] **Step 1: Document setup**

1. Neon `DATABASE_URL`
2. Google OAuth redirect `http://localhost:3000/api/auth/callback/google`
3. `AUTH_SECRET` + 64-hex `ENCRYPTION_KEY`
4. `npm install`
5. `npx prisma db push`
6. `npm run dev`
7. Flow: `/` -> `/signup` -> onboarding -> `/app`

- [ ] **Step 2: Final verification**

```powershell
npm test
npm run build
```

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: add local setup for neon google auth and komenin foundation"
```

---

## Spec Coverage Check (this plan)

| Spec area | Covered here? |
|---|---|
| Untitled UI + Next bootstrap | Task 1 |
| Design tokens / clean aesthetic | Task 2 |
| Neon multi-tenant foundation | Task 3-4, 6 |
| Google auth | Task 5, 9 |
| Marketing pages | Task 7-8 |
| Onboarding + invites | Task 6, 9 |
| App shell IA / dashboard / settings | Task 10 |
| Session Routing module | Follow-on plan |
| Comment Engine module | Follow-on plan |
| Agent Intelligence module | Follow-on plan |
| Skill Execution module | Follow-on plan |
| Platform admin | Later plan |
| Stripe billing | Skeleton only |

---

## Self-Review Notes

- Foundation scope has concrete steps and code for critical paths
- Role names match design spec exactly
- Encryption utility included early for future session vault
- Real social automation workers deferred intentionally

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-14-komenin-foundation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** - fresh subagent per task, review between tasks
2. **Inline Execution** - execute in this session with checkpoints

Which approach?
