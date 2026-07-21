import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/encryption";
import { safeOutboundFetch, UnsafeUrlError } from "@/lib/url-safety";
import type { NotificationEvent } from "./channels";
import { detectFormatter, formatDiscordEmbed, formatGeneric, formatSlackPayload } from "./formatters";

type DispatchData = {
  title: string;
  body: string;
  href?: string;
};

export async function dispatchExternal(event: NotificationEvent, workspaceId: string, data: DispatchData) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: {
      workspaceId,
      isActive: true,
    },
  });

  // Filter by actions — if actions empty means all events, else must include event
  const matched = endpoints.filter((ep) => {
    if (!ep.actions || ep.actions.length === 0) return true;
    return ep.actions.includes(event);
  });

  if (matched.length === 0) return { dispatched: 0 };

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const ep of matched) {
    try {
      const formatterType = detectFormatter(ep.url, ep.name);
      let payload: unknown;
      const notifyData = {
        title: data.title,
        body: data.body,
        href: data.href,
        workspaceName: workspace?.name,
      };

      if (formatterType === "slack") payload = formatSlackPayload(event, notifyData);
      else if (formatterType === "discord") payload = formatDiscordEmbed(event, notifyData);
      else payload = formatGeneric(event, notifyData);

      let secret: string | null = null;
      if (ep.secretEnc) {
        try {
          secret = decryptSecret(ep.secretEnc);
        } catch {
          secret = null;
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-aether-event": event,
        "User-Agent": "Aether-Webhook/1.0",
      };
      if (secret) headers["Authorization"] = `Bearer ${secret}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      let res: Response;
      try {
        res = await safeOutboundFetch(ep.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof UnsafeUrlError) {
          throw new Error(`Blocked unsafe webhook URL: ${error.message}`);
        }
        throw error;
      }

      clearTimeout(timeout);
      results.push({ id: ep.id, ok: res.ok, error: res.ok ? undefined : `${res.status} ${res.statusText}` });

      // Log delivery
      await db.deliveryLog.create({
        data: {
          workspaceId,
          kind: "health_probe",
          connector: ep.name.toLowerCase().includes("slack") ? "slack" : ep.name.toLowerCase().includes("discord") ? "discord" : "webhook",
          mode: "live",
          ok: res.ok,
          message: `External notify ${event}: ${res.status}`,
          payload: { event, endpointId: ep.id, status: res.status } as never,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id: ep.id, ok: false, error: msg });
      await db.deliveryLog.create({
        data: {
          workspaceId,
          kind: "health_probe",
          connector: "webhook",
          mode: "live",
          ok: false,
          message: `External notify ${event} failed: ${msg}`,
          payload: { event, endpointId: ep.id, error: msg } as never,
        },
      });
    }
  }

  return { dispatched: matched.length, results };
}

export async function dispatchForUnreadNotifications(workspaceId: string, limit = 10) {
  const { ALL_EVENTS } = await import("./channels");
  // Simple: dispatch external for unread notifications that map to events
  const unread = await db.notification.findMany({
    where: { workspaceId, status: "unread" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  for (const n of unread) {
    // Map notification title to event heuristic
    const lower = `${n.title} ${n.body}`.toLowerCase();
    let event: NotificationEvent | null = null;
    if (lower.includes("degraded")) event = "account.degraded";
    else if (lower.includes("failed") && lower.includes("comment")) event = "comment.failed";
    else if (lower.includes("failed") && (lower.includes("content") || lower.includes("publish"))) event = "content.failed";
    else if (lower.includes("usage") || lower.includes("limit")) event = "usage.warning";
    else if (lower.includes("approval") && lower.includes("review")) event = "approval.new";
    else continue; // unknown event, skip

    await dispatchExternal(event, workspaceId, {
      title: n.title,
      body: n.body,
      href: n.href || undefined,
    });
  }

  return { processed: unread.length };
}
