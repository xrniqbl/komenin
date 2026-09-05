# Support Tickets & CS Email Delivery Design

**Date:** 2026-09-05  
**Status:** Approved design — implementation staged (2 phases)  
**Product:** Komenin / Aether (repo: lokarouter)  
**Epic type:** Net-new support surface (user-reported problems reach CS reliably)

---

## 1. Summary

Today a user with a problem has only the public `/contact` form. Submissions are
stored in the platform audit log and optionally relayed via `CONTACT_WEBHOOK_URL`,
but **no email is sent anywhere** — `cs@komenin.id` is not wired into the code at
all, and there is no in-app way to report an issue with workspace/plan context,
track status, or continue a conversation.

This epic ships two phases:

1. **Phase 1 (small, immediate):** `/api/contact` sends each submission as an
   email to the support inbox (`SUPPORT_INBOX_EMAIL`, default `cs@komenin.id`)
   through the existing Brevo `sendEmail()` helper.
2. **Phase 2 (full feature):** an in-app two-way ticket system — `SupportTicket`
   + `SupportTicketMessage` tables, `/app/support` for reporters, `/admin/support`
   queue for CS, email notifications on every event, in-app notifications, and
   audit logging.

**Decision locked:** CS replies in-app (admin UI); reporters receive email
notifications + can reply in-app. No inbound-email parsing. Approach: dedicated
tables + server actions following existing repo patterns (option A).

---

## 2. Goals & non-goals

### Goals

- Every `/contact` submission reaches `cs@komenin.id` by email automatically.
- A logged-in user can open a ticket from `/app/support` with automatic context
  (name, email, active workspace, plan) and follow the conversation until close.
- CS can triage all tickets in `/admin/support`: reply, change status/priority.
- Reporters are notified (email + in-app notification) on every CS reply or
  status change; CS is emailed on every new ticket.
- All sends are best-effort (`sendEmail()` never throws); ticket data stays the
  source of truth.
- Audit trail for ticket lifecycle, consistent with `contact.submitted`.

### Non-goals

- No inbound email (no IMAP/Brevo inbound parsing, no email-to-ticket bridge).
- No attachments/screenshots in v1 (text only).
- No internal CS-only notes in v1.
- No SLA timers, assignment/ownership, or CS team roles — the queue is visible
  to superadmins; assignment can come later.
- No i18n for the new `/app` + `/admin` pages (existing app/admin pages are
  English-only; marketing i18n stays untouched).

---

## 3. Phase 1 — Contact form email

**File:** `src/app/api/contact/route.ts` (plus `.env.example` docs).

After the audit write (and independently of the optional webhook):

- Build an email via a small pure builder in `src/lib/email.ts`
  (`buildContactNotification`) and send with `sendEmail()`.
- **To:** `process.env.SUPPORT_INBOX_EMAIL?.trim() || "cs@komenin.id"`.
- **Reply-To:** the submitter's email (CS replies straight to the person).
- **Subject:** `[Komenin Contact] <name> — <truncated message>`.
- Body: name, email, submitted-at, message (full text), audit id.
- Failure to send logs a warning and never fails the request (same contract as
  the existing webhook path). `deliveredVia` gains `"email"` on success and the
  audit metadata update includes it.
- No new required env: `SUPPORT_INBOX_EMAIL` is optional with a sensible
  default; documented in `.env.example`.

Verification: `tsc`, `lint`, `vitest`, render check of `/contact` unchanged;
unit test for the builder (to/subject/replyTo/body invariants).

---

## 4. Phase 2 — In-app ticket system

### 4.1 Data model (Prisma)

```prisma
enum SupportTicketStatus   { open in_progress resolved closed }
enum SupportTicketCategory { bug billing account feature other }
enum SupportTicketPriority { low normal high }
enum SupportTicketAuthor   { reporter cs system }

model SupportTicket {
  id            String   @id @default(cuid())
  subject       String
  status        SupportTicketStatus    @default(open)
  category      SupportTicketCategory
  priority      SupportTicketPriority  @default(normal)
  reporterId    String
  reporterEmail String            // snapshot
  reporterName  String            // snapshot
  workspaceId   String?           // optional context
  workspaceName String?           // snapshot
  resolvedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  reporter  User            @relation(fields: [reporterId], references: [id])
  workspace Workspace?      @relation(fields: [workspaceId], references: [id])
  messages  SupportTicketMessage[]

  @@index([status, createdAt])
  @@index([reporterId])
}

model SupportTicketMessage {
  id         String   @id @default(cuid())
  ticketId   String
  authorRole SupportTicketAuthor
  authorId   String?  // null for system entries
  body       String
  createdAt  DateTime @default(now())

  ticket SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
}
```

Priority is auto-derived on create from category (`bug`/`billing` → `normal`,
others → `low`) and can be overridden by CS. Snapshot fields keep the queue
informative even if the reporter later changes email or leaves the workspace.

### 4.2 Server logic — `src/server/support.ts`

Single unit owning all rules; UI pages only call it:

- `createSupportTicket(reporter, {category, subject, body})` — auth via session,
  active-workspace lookup for context, zod validation, rate limit
  (5 tickets / 10 min per user, `consumeRateLimit`), insert ticket + first
  message (`authorRole: reporter`), audit `support.ticket_created`, email CS,
  in-app notification (confirmation).
- `listMyTickets()` / `getTicketForReporter(ticketId)` — reporter-scoped reads
  (guard: `reporterId` must match session user).
- `replyAsReporter(ticketId, body)` — append message, audit, nothing emailed
  (CS sees it in the queue; no self-notification spam).
- Admin (each starts with `requireSuperAdmin()`):
  `listSupportTickets({status?, category?})`,
  `getTicketAsAdmin(ticketId)`, `replyAsCs(ticketId, body)` (append `cs`
  message → email reporter + in-app notification), `setTicketStatus(ticketId,
  status)` (legal-transition map, sets `resolvedAt` on `resolved`,
  audit `support.ticket_status_changed`, email + in-app notification),
  `setTicketPriority(ticketId, priority)`.

Legal status transitions: `open → in_progress|resolved|closed`,
`in_progress → resolved|closed|open`, `resolved → closed|open`,
`closed → open` (reopen). Illegal transitions are rejected with a clear error.
Permission split: CS may apply any legal transition; reporters may close their
own ticket from `open`/`in_progress`/`resolved` and reopen (`→ open`) from
`resolved`/`closed`.

### 4.3 Email (`src/lib/support-email.ts` + `sendEmail`)

| Event | To | Subject | Body |
|---|---|---|---|
| Ticket created | `SUPPORT_INBOX_EMAIL` (default `cs@komenin.id`) | `[Ticket <id8>] <category> — <subject>` | reporter name/email, workspace, plan, body; Reply-To reporter |
| CS reply | reporter | `[Ticket <id8>] New reply from Komenin support` | reply body + link `/app/support/<id>` |
| Status change | reporter | `[Ticket <id8>] Status: <status>` | new status + link |

Builders are pure functions (unit-testable); all sends best-effort with
`console.warn` on failure.

### 4.4 UI

**Reporter — `/app/support` (list + create), `/app/support/[id]` (thread):**
- List: own tickets (status badge, category, age), "New ticket" button.
- Create form (client component + server action): category select, subject,
  body. Context attached server-side; not user-editable.
- Detail: full message thread (reporter ↔ cs ↔ system), status badge, reply box,
  "Close ticket" (allowed from open/in_progress/resolved).
- Sidebar entry "Support".

**CS — `/admin/support` (queue), `/admin/support/[id]`:**
- Queue: table (status/category filter tabs, reporter, workspace, priority, age)
  following existing admin table patterns (`Card`/`Table`/`Empty`/`Badge`).
- Detail: conversation, reply box, status + priority controls.

### 4.5 Audit & notifications

- Audit actions: `support.ticket_created`, `support.ticket_replied`,
  `support.ticket_status_changed` (resourceType `support_ticket`).
- In-app `Notification` rows for the reporter on CS reply / status change /
  creation confirmation, using the existing notification service.

---

## 5. Error handling

- Email failure: never blocks the main flow; warning logged (existing contract).
- Rate limit exceeded: 429 with `Retry-After` (same shape as `/api/contact`).
- Validation: zod — category enum, subject 5–150 chars, body 20–5000 chars.
- Permission: reporter can read/reply only own tickets; admin routes gated by
  `requireSuperAdmin()`.
- Illegal status transition: explicit error surfaced in UI.

## 6. Testing

- Unit (no live DB, following `tests/unit/product-flow.e2e.ts` style):
  zod schemas; status-transition map (legal + illegal pairs); priority
  derivation; email subject/body builders (to, replyTo, truncation, ids).
- Manual dev smoke: create → reply as CS → status changes, with and without
  `BREVO_API_KEY` (must succeed with warnings when unconfigured).
- Gates before each commit: `tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build`.

## 7. Delivery plan

| Phase | Scope | Commit |
|---|---|---|
| 1 | Contact-form email + `SUPPORT_INBOX_EMAIL` docs + builder unit test | separate |
| 2 | Migration, `src/server/support.ts`, reporter UI, admin queue, emails, notifications, audit, unit tests | separate |

Both phases are implemented after the concurrent security/SSO refactor currently
in flight lands (working tree must pass `tsc` first) to avoid collisions.
