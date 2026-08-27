import type { NotificationEvent } from "./channels";

type NotifyData = {
  title?: string;
  body?: string;
  href?: string;
  workspaceName?: string;
  extra?: Record<string, unknown>;
};

function extraFieldLines(extra?: Record<string, unknown>): string {
  if (!extra) return "";
  const preferred = ["handle", "email", "status", "source", "client", "campaign", "platform", "intent"];
  const lines: string[] = [];
  for (const key of preferred) {
    if (extra[key] == null || extra[key] === "") continue;
    lines.push(`*${key}:* ${String(extra[key])}`);
  }
  return lines.length ? `\n${lines.join("\n")}` : "";
}

export function formatSlackPayload(event: NotificationEvent, data: NotifyData) {
  return {
    text: `Komenin: ${data.title || event}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: data.title || event },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${data.body || ""}${extraFieldLines(data.extra)}\n${data.href ? `<${data.href}|View in Komenin>` : ""}`,
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
  const extraFields = data.extra
    ? Object.entries(data.extra)
        .filter(([, v]) => v != null && v !== "")
        .slice(0, 8)
        .map(([name, value]) => ({
          name,
          value: String(value).slice(0, 200),
          inline: true,
        }))
    : [];

  return {
    embeds: [
      {
        title: data.title || event,
        description: data.body || "",
        color:
          event.includes("failed") || event === "account.degraded" || event === "account.reauth_required"
            ? 0xe11d48
            : event === "lead.captured"
              ? 0x16a34a
              : 0x6366f1,
        fields: [
          { name: "Event", value: event, inline: true },
          { name: "Workspace", value: data.workspaceName || "—", inline: true },
          ...extraFields,
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
    source: "komenin",
  };
}

export function detectFormatter(url: string, name: string): "slack" | "discord" | "generic" {
  const lower = `${url} ${name}`.toLowerCase();
  if (lower.includes("slack") || lower.includes("hooks.slack")) return "slack";
  if (lower.includes("discord")) return "discord";
  return "generic";
}
