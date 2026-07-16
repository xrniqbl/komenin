import type { NotificationEvent } from "./channels";

type NotifyData = {
  title?: string;
  body?: string;
  href?: string;
  workspaceName?: string;
  extra?: Record<string, unknown>;
};

export function formatSlackPayload(event: NotificationEvent, data: NotifyData) {
  return {
    text: `Aether: ${data.title || event}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: data.title || event },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${data.body || ""}\n${data.href ? `<${data.href}|View in Aether>` : ""}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `Event: \`${event}\` · Workspace: ${data.workspaceName || "—"}` },
        ],
      },
    ],
  };
}

export function formatDiscordEmbed(event: NotificationEvent, data: NotifyData) {
  return {
    embeds: [
      {
        title: data.title || event,
        description: data.body || "",
        color: event.includes("failed") || event === "account.degraded" ? 0xe11d48 : 0x6366f1,
        fields: [
          { name: "Event", value: event, inline: true },
          { name: "Workspace", value: data.workspaceName || "—", inline: true },
          ...(data.href ? [{ name: "Link", value: data.href, inline: false }] : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function formatGeneric(event: NotificationEvent, data: NotifyData) {
  return {
    event,
    title: data.title,
    body: data.body,
    href: data.href,
    workspace: data.workspaceName,
    extra: data.extra,
    timestamp: new Date().toISOString(),
    source: "aether",
  };
}

export function detectFormatter(url: string, name: string): "slack" | "discord" | "generic" {
  const lower = `${url} ${name}`.toLowerCase();
  if (lower.includes("slack") || lower.includes("hooks.slack")) return "slack";
  if (lower.includes("discord")) return "discord";
  return "generic";
}
