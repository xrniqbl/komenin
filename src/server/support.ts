import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  canTransition,
  derivePriority,
  reporterCanTransition,
  supportReplySchema,
  supportTicketSchema,
  type SupportCategory,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support";
import {
  buildNewTicketEmailToCs,
  buildReplyEmailToReporter,
  buildStatusEmailToReporter,
} from "@/lib/support-email";
import { writeAuditLog } from "@/server/audit";
import { requireSuperAdmin } from "@/server/admin";
import { requireActiveWorkspace } from "@/server/workspace-access";

export type SupportResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number };

type SessionUser = { id: string; name?: string | null; email?: string | null };

async function requireUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.totpGate) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

function fail(error: string, status: number): SupportResult {
  return { ok: false, error, status };
}

function revalidateTicketPaths(ticketId: string) {
  revalidatePath("/app/support");
  revalidatePath(`/app/support/${ticketId}`);
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
}

function notifyWorkspace(workspaceId: string, ticketId: string, title: string, body: string) {
  return db.notification.create({
    data: { workspaceId, title, body, href: `/app/support/${ticketId}` },
  });
}

/** Create a ticket for the signed-in reporter with automatic context. */
export async function createSupportTicket(input: {
  category: SupportCategory;
  subject: string;
  body: string;
}): Promise<SupportResult> {
  const user = await requireUser();
  if (!user) return fail("Sign in required", 401);

  const rate = await consumeRateLimit({
    key: `support:create:${user.id}`,
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rate.ok) return fail("Too many tickets opened. Please try again shortly.", 429);

  const parsed = supportTicketSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Invalid input", 400);
  }

  const { workspace } = await requireActiveWorkspace();
  const priority = derivePriority(parsed.data.category);

  const ticket = await db.supportTicket.create({
    data: {
      subject: parsed.data.subject,
      category: parsed.data.category,
      priority,
      status: "open",
      reporterId: user.id,
      reporterEmail: user.email || "",
      reporterName: user.name || null,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      messages: {
        create: {
          authorRole: "reporter",
          authorId: user.id,
          authorName: user.name || null,
          body: parsed.data.body,
        },
      },
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: "support.ticket_created",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    metadata: { category: ticket.category, subject: ticket.subject, priority },
  });

  await sendEmail(
    buildNewTicketEmailToCs({
      ticketId: ticket.id,
      category: ticket.category as SupportCategory,
      subject: ticket.subject,
      body: parsed.data.body,
      reporterName: user.name || user.email || "A user",
      reporterEmail: user.email || "",
      workspaceName: workspace.name,
      submittedAt: ticket.createdAt,
    }),
  );

  await notifyWorkspace(
    workspace.id,
    ticket.id,
    `Ticket ${ticket.id.slice(-8)} created`,
    `Support received: ${ticket.subject}`,
  );

  revalidateTicketPaths(ticket.id);
  return { ok: true, id: ticket.id };
}

/** Tickets opened by the current reporter, newest first. */
export async function listMyTickets() {
  const user = await requireUser();
  if (!user) return [];
  return db.supportTicket.findMany({
    where: {
      reporterId: user.id,
      workspace: { memberships: { some: { userId: user.id, status: "active" } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { messages: true } } },
  });
}

async function loadTicketForReporter(ticketId: string, userId: string) {
  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket || ticket.reporterId !== userId) return null;
  if (ticket.workspaceId) {
    const membership = await db.membership.findFirst({
      where: { workspaceId: ticket.workspaceId, userId, status: "active" },
      select: { id: true },
    });
    if (!membership) return null;
  }
  return ticket;
}

export async function getTicketForReporter(ticketId: string) {
  const user = await requireUser();
  if (!user) return null;
  return loadTicketForReporter(ticketId, user.id);
}

/** Reporter reply — appends to the conversation; CS sees it in the queue. */
export async function replyAsReporter(ticketId: string, body: string): Promise<SupportResult> {
  const user = await requireUser();
  if (!user) return fail("Sign in required", 401);

  const parsed = supportReplySchema.safeParse({ body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid input", 400);

  const ticket = await loadTicketForReporter(ticketId, user.id);
  if (!ticket) return fail("Ticket not found", 404);
  if (ticket.status === "closed") return fail("Ticket is closed — reopen it to reply.", 400);

  await db.supportTicketMessage.create({
    data: {
      ticketId,
      authorRole: "reporter",
      authorId: user.id,
      authorName: user.name || null,
      body: parsed.data.body,
    },
  });

  await writeAuditLog({
    workspaceId: ticket.workspaceId,
    actorUserId: user.id,
    action: "support.ticket_replied",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    metadata: { authorRole: "reporter" },
  });

  revalidateTicketPaths(ticketId);
  return { ok: true, id: ticketId };
}

/** Reporter close/reopen — limited to the permission split in the spec. */
export async function setReporterTicketStatus(
  ticketId: string,
  to: SupportStatus,
): Promise<SupportResult> {
  const user = await requireUser();
  if (!user) return fail("Sign in required", 401);

  const ticket = await loadTicketForReporter(ticketId, user.id);
  if (!ticket) return fail("Ticket not found", 404);
  if (!reporterCanTransition(ticket.status as SupportStatus, to)) {
    return fail("You can only close or reopen this ticket.", 400);
  }

  await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: to, resolvedAt: to === "closed" ? ticket.resolvedAt : null },
  });

  await writeAuditLog({
    workspaceId: ticket.workspaceId,
    actorUserId: user.id,
    action: "support.ticket_status_changed",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    metadata: { from: ticket.status, to, actorRole: "reporter" },
  });

  revalidateTicketPaths(ticketId);
  return { ok: true, id: ticketId };
}

// ---------------------------------------------------------------------------
// Admin (CS) side — every entry point is superadmin-gated.
// ---------------------------------------------------------------------------

export async function listAllSupportTickets(filter?: {
  status?: SupportStatus;
  category?: SupportCategory;
}) {
  await requireSuperAdmin();
  return db.supportTicket.findMany({
    where: {
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.category ? { category: filter.category } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { messages: true } } },
  });
}

export async function getTicketAsAdmin(ticketId: string) {
  await requireSuperAdmin();
  return db.supportTicket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

/** CS reply — appends a cs message, emails the reporter, notifies the workspace. */
export async function replyAsCs(ticketId: string, body: string): Promise<SupportResult> {
  const { userId } = await requireSuperAdmin();

  const parsed = supportReplySchema.safeParse({ body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid input", 400);

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return fail("Ticket not found", 404);

  await db.supportTicketMessage.create({
    data: {
      ticketId,
      authorRole: "cs",
      authorId: userId,
      body: parsed.data.body,
    },
  });

  if (ticket.status === "open") {
    await db.supportTicket.update({ where: { id: ticketId }, data: { status: "in_progress" } });
  }

  await writeAuditLog({
    workspaceId: ticket.workspaceId,
    actorUserId: userId,
    action: "support.ticket_replied",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    metadata: { authorRole: "cs" },
  });

  await sendEmail(
    buildReplyEmailToReporter({
      ticketId,
      subject: ticket.subject,
      reporterEmail: ticket.reporterEmail,
      replyBody: parsed.data.body,
    }),
  );

  if (ticket.workspaceId) {
    await notifyWorkspace(
      ticket.workspaceId,
      ticketId,
      `Ticket ${ticket.id.slice(-8)} — support replied`,
      ticket.subject,
    );
  }

  revalidateTicketPaths(ticketId);
  return { ok: true, id: ticketId };
}

/** CS status change — enforces the transition map, emails + notifies the reporter. */
export async function setTicketStatusAsCs(
  ticketId: string,
  to: SupportStatus,
): Promise<SupportResult> {
  const { userId } = await requireSuperAdmin();

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return fail("Ticket not found", 404);
  const from = ticket.status as SupportStatus;
  if (!canTransition(from, to)) return fail(`Cannot move a ${from} ticket to ${to}.`, 400);

  await db.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: to,
      resolvedAt: to === "resolved" ? new Date() : from === "resolved" ? null : ticket.resolvedAt,
    },
  });

  await writeAuditLog({
    workspaceId: ticket.workspaceId,
    actorUserId: userId,
    action: "support.ticket_status_changed",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    metadata: { from, to, actorRole: "cs" },
  });

  await sendEmail(
    buildStatusEmailToReporter({
      ticketId,
      subject: ticket.subject,
      reporterEmail: ticket.reporterEmail,
      status: to,
    }),
  );

  if (ticket.workspaceId) {
    await notifyWorkspace(
      ticket.workspaceId,
      ticketId,
      `Ticket ${ticket.id.slice(-8)} is now ${to}`,
      ticket.subject,
    );
  }

  revalidateTicketPaths(ticketId);
  return { ok: true, id: ticketId };
}

/** CS priority override. */
export async function setTicketPriorityAsCs(
  ticketId: string,
  priority: SupportPriority,
): Promise<SupportResult> {
  const { userId } = await requireSuperAdmin();

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return fail("Ticket not found", 404);

  await db.supportTicket.update({ where: { id: ticketId }, data: { priority } });

  await writeAuditLog({
    workspaceId: ticket.workspaceId,
    actorUserId: userId,
    action: "support.ticket_priority_changed",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    metadata: { from: ticket.priority, to: priority },
  });

  revalidateTicketPaths(ticketId);
  return { ok: true, id: ticketId };
}
