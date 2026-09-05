# Support Tickets & CS Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contact-form submissions reach `cs@komenin.id` by email (phase 1), and logged-in users get a two-way in-app ticket system with a CS admin queue (phase 2).

**Architecture:** Pure logic (validation, status transitions, email builders) lives in `src/lib/support.ts` / `src/lib/support-email.ts` so it is unit-testable without a DB. All DB orchestration and permission guards live in `src/server/support.ts`; thin `"use server"` action files bridge client forms to it. UI follows existing `/app` + `/admin` server-component patterns (Card/Table/Empty/Badge).

**Tech Stack:** Next.js App Router (server components + inline server actions), Prisma + PostgreSQL, Brevo HTTP email via existing `sendEmail()`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-support-tickets-design.md`

**Constraint:** A concurrent security/SSO refactor may be in flight in the same working tree. Every commit is **pathspec-scoped** to files this plan touches; never `git add -A`.

---

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/lib/email.ts` | Modify | + `buildContactNotification()` (phase 1) |
| `src/app/api/contact/route.ts` | Modify | send email to support inbox (phase 1) |
| `.env.example` | Modify | document `SUPPORT_INBOX_EMAIL` |
| `tests/unit/support-email.test.ts` | Create | builder tests (both phases) |
| `prisma/schema.prisma` | Modify | enums + `SupportTicket` + `SupportTicketMessage` + relations |
| `prisma/migrations/<ts>_support_tickets/migration.sql` | Create | migration SQL |
| `src/lib/support.ts` | Create | categories/statuses/priorities, zod, transitions, priority derivation, `supportInbox()` |
| `src/lib/support-email.ts` | Create | ticket email builders (pure) |
| `src/server/support.ts` | Create | all DB logic + guards + email/notification/audit side effects |
| `tests/unit/support.test.ts` | Create | pure-logic tests |
| `src/app/app/support/page.tsx` | Create | reporter ticket list |
| `src/app/app/support/new/page.tsx` | Create | new-ticket form (inline action) |
| `src/app/app/support/[ticketId]/page.tsx` | Create | thread + reply/close/reopen (inline actions) |
| `src/app/admin/support/page.tsx` | Create | CS queue |
| `src/app/admin/support/[ticketId]/page.tsx` | Create | CS detail: reply + status + priority (inline actions) |
| `src/components/app/app-sidebar.tsx` | Modify | "Support" entry |
| `src/components/admin/admin-shell.tsx` | Modify | "Support" entry |

---

## Phase 1 — Contact email

### Task 1: Contact email builder + test

**Files:** Modify `src/lib/email.ts`; Create `tests/unit/support-email.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildContactNotification } from "@/lib/email";

describe("buildContactNotification", () => {
  it("targets the support inbox with reply-to the submitter", () => {
    const msg = buildContactNotification({
      name: "Budi", email: "budi@brand.id",
      message: "Saya tidak bisa connect akun Instagram.", auditId: "aud_1",
      submittedAt: new Date("2026-09-05T08:00:00Z"),
    });
    expect(msg.to).toBe("cs@komenin.id");
    expect(msg.replyTo).toBe("budi@brand.id");
    expect(msg.subject).toContain("Budi");
    expect(msg.html).toContain("budi@brand.id");
    expect(msg.html).toContain("Instagram");
  });

  it("honors SUPPORT_INBOX_EMAIL and truncates long subjects", () => {
    process.env.SUPPORT_INBOX_EMAIL = "help@other.id";
    const msg = buildContactNotification({
      name: "A".repeat(120), email: "a@b.id", message: "x".repeat(80),
      auditId: "aud_2", submittedAt: new Date(),
    });
    expect(msg.to).toBe("help@other.id");
    expect(msg.subject.length).toBeLessThan(120);
    delete process.env.SUPPORT_INBOX_EMAIL;
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run tests/unit/support-email.test.ts` (import error)
- [ ] **Step 3: Implement in `src/lib/email.ts`**

```ts
export function supportInbox(): string {
  return process.env.SUPPORT_INBOX_EMAIL?.trim() || "cs@komenin.id";
}

export function buildContactNotification(input: {
  name: string; email: string; message: string;
  auditId: string; submittedAt: Date;
}): EmailMessage {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const subjectName = input.name.length > 40 ? `${input.name.slice(0, 37)}...` : input.name;
  return {
    to: supportInbox(),
    replyTo: input.email,
    subject: `[Komenin Contact] ${subjectName}`,
    text: `New contact submission (${input.auditId})\n\nName: ${input.name}\nEmail: ${input.email}\nAt: ${input.submittedAt.toISOString()}\n\n${input.message}`,
    html: `<h2>New contact submission</h2>
<p><b>From:</b> ${esc(input.name)} &lt;${esc(input.email)}&gt;<br/>
<b>At:</b> ${input.submittedAt.toISOString()}<br/>
<b>Audit id:</b> ${esc(input.auditId)}</p>
<pre style="white-space:pre-wrap;font-family:inherit">${esc(input.message)}</pre>`,
  };
}
```

- [ ] **Step 4: Run → PASS**; commit scoped.

### Task 2: Wire email into `/api/contact`

**Files:** Modify `src/app/api/contact/route.ts`, `.env.example`

- [ ] **Step 1:** Import `buildContactNotification` + `sendEmail` from `@/lib/email`; after the webhook block (before the metadata update), add best-effort send; push `"email"` into `deliveredVia` when `res.delivered`; include email status in the metadata update payload.
- [ ] **Step 2:** `.env.example` — document under email section:

```env
# Optional. Support inbox for contact form + support tickets (default: cs@komenin.id)
SUPPORT_INBOX_EMAIL="cs@komenin.id"
```

- [ ] **Step 3:** `npx tsc --noEmit` (only pre-existing concurrent-refactor errors allowed), `npx vitest run tests/unit/support-email.test.ts tests/unit/contact-schema.test.ts` → PASS. Commit scoped.

---

## Phase 2 — In-app tickets

### Task 3: Prisma schema + migration

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/<ts>_support_tickets/migration.sql`

- [ ] **Step 1:** Add enums (near other enums), models, and relations (`User.supportTickets`, `Workspace.supportTickets`) per spec §4.1.
- [ ] **Step 2:** Generate migration. Try `npx prisma migrate dev --create-only --name support_tickets`; if no dev DB, generate SQL offline:
  `npx prisma migrate diff --from-schema-datamodel prisma/schema.prev.prisma --to-schema-datamodel prisma/schema.prisma --script` (keep a pre-edit copy as `schema.prev.prisma`, delete it after) and save as `prisma/migrations/20260905100000_support_tickets/migration.sql`.
- [ ] **Step 3:** `npx prisma generate` → client includes `db.supportTicket`. `npx tsc --noEmit` unchanged errors. Commit scoped (schema + migration).

### Task 4: Pure logic + builders + tests

**Files:** Create `src/lib/support.ts`, `src/lib/support-email.ts`; Create `tests/unit/support.test.ts`

`src/lib/support.ts`: `SUPPORT_CATEGORIES/STATUSES/PRIORITIES` const tuples + types, `supportTicketSchema` (category enum, subject 5–150, body 20–5000), `supportReplySchema` (body 2–5000), `canTransition(from,to)` with map `open→[in_progress,resolved,closed]`, `in_progress→[open,resolved,closed]`, `resolved→[open,closed]`, `closed→[open]` (no self-transition), `derivePriority` (bug/billing→normal else low), `supportInbox()`, `ticketShortId(id)=id.slice(-8)`, `REPORTER_ALLOWED_TRANSITIONS` (close from open/in_progress/resolved → closed; reopen from resolved/closed → open).

`src/lib/support-email.ts`: `buildNewTicketEmailToCs`, `buildReplyEmailToReporter`, `buildStatusEmailToReporter` — pure, return `{to, replyTo?, subject, html, text}`; subjects use `ticketShortId`; html includes link `${process.env.APP_URL ?? ""}/app/support/${ticketId}` for reporter-facing mails.

Tests: schema accept/reject boundaries, transition legal/illegal pairs, reporter permission pairs, priority derivation, builder fields (to/replyTo/subject/id truncation/link).

- [ ] Steps: test → FAIL → implement → PASS → commit scoped.

### Task 5: Server orchestration `src/server/support.ts`

**Files:** Create `src/server/support.ts`

Functions (guards inside each; auth via `auth()` from `@/lib/auth`, workspace context via `requireActiveWorkspace()` from `@/server/workspace-access`, admin gate via `requireSuperAdmin()` from `@/server/admin`, audit via `writeAuditLog`, rate limit via `consumeRateLimit`):

- `createSupportTicket({category, subject, body})` → rate-limit 5/10min per user → validate → `db.supportTicket.create` (nested first message) → audit `support.ticket_created` → `sendEmail(buildNewTicketEmailToCs(...))` → `db.notification.create` (workspace, href detail) → revalidate → return `{ok:true, id}` / `{ok:false,error}`.
- `listMyTickets()` → `findMany where reporterId` order desc take 100 + `_count.messages`.
- `getTicketForReporter(ticketId)` → 404 unless `reporterId` matches; include messages asc.
- `replyAsReporter(ticketId, body)` → own ticket, status ≠ closed, validate, append message, audit `support.ticket_replied`.
- `setReporterTicketStatus(ticketId, to)` → only close/reopen per `REPORTER_ALLOWED_TRANSITIONS`, `canTransition`, audit.
- Admin: `listAllSupportTickets({status?, category?})`, `getTicketAsAdmin(id)`, `replyAsCs(ticketId, body)` (+email reporter + notification), `setTicketStatusAsCs(ticketId, to)` (canTransition, `resolvedAt` set/clear on enter/leave resolved, +email +notification +audit), `setTicketPriorityAsCs(ticketId, priority)` (+audit).

All email/notification/audit side effects wrapped so ticket mutation is the source of truth; revalidatePath after mutations.

- [ ] Verify: `npx tsc --noEmit` unchanged errors. Commit scoped.

### Task 6: Reporter UI

**Files:** Create `src/app/app/support/page.tsx`, `src/app/app/support/new/page.tsx`, `src/app/app/support/[ticketId]/page.tsx`; Modify `src/components/app/app-sidebar.tsx`

- List: `requireActiveWorkspace()` → `listMyTickets()`; Card+Table (status Badge, category, subject link, messages count, age); Empty state with CTA; "New ticket" button.
- New: client form component (category select, subject, body) calling inline server action → `redirect(/app/support/${id})` on success; shows validation errors.
- Detail: thread (reporter/cs/system bubbles), status Badge, reply form (hidden when closed), Close / Reopen buttons (server actions).
- Sidebar: add `{ label: "Support", href: "/app/support", icon: LifeBuoy }` to the Workspace group.

- [ ] Verify: `npx tsc --noEmit`, `npm run lint` scoped, dev-render `/app/support` (redirects to login when unauthenticated = guard works). Commit scoped.

### Task 7: Admin queue UI

**Files:** Create `src/app/admin/support/page.tsx`, `src/app/admin/support/[ticketId]/page.tsx`; Modify `src/components/admin/admin-shell.tsx`

- Queue: `requireSuperAdmin()` → `listAllSupportTickets({status: searchParams.status})`; status filter links (all/open/in_progress/resolved/closed); Table columns: subject, reporter, workspace, category, priority, status, age.
- Detail: conversation, reply form, status + priority selects (server actions).
- Admin shell links: `{ href: "/admin/support", label: "Support", icon: LifeBuoy }` after Jobs.

- [ ] Verify: tsc + lint scoped. Commit scoped.

### Task 8: Full gates

- [ ] `npx tsc --noEmit` — zero NEW errors vs pre-existing concurrent-refactor errors
- [ ] `npm run lint` — zero warnings on all touched files
- [ ] `npm test` — all suites pass (includes new `tests/unit/support*.test.ts`)
- [ ] Final scoped commit for any residue (env docs etc.)
