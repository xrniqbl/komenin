import type {
  ConnectorAction,
  ConnectorKind,
  ConnectorPolicy,
  RuntimeMode,
} from "@/lib/connectors/types";

export type ConnectorKindInput = {
  runtimeMode: RuntimeMode;
  policy: ConnectorPolicy;
  hasWebhook: boolean;
  hasOfficial: boolean;
  /** Optional so existing callers that predate the session path stay valid. */
  hasSession?: boolean;
  action: ConnectorAction;
};

/**
 * Resolution order.
 *
 * Simulator and *_only policies short-circuit first — they are explicit
 * operator intent and must never be silently upgraded by a better credential
 * showing up.
 *
 * The default live chain (prefer_webhook) keeps webhook ahead of session
 * because a webhook is our own backend doing the work, while `session` means
 * hitting Instagram's undocumented private API with a real user cookie —
 * slower, ban-prone, and expiring. `prefer_session` flips the order for
 * workspaces that deliberately run without a Meta App Review.
 */
export function resolveConnectorKind(input: ConnectorKindInput): ConnectorKind {
  if (input.runtimeMode === "simulator" || input.policy === "simulator_only") {
    return "simulator";
  }

  if (input.policy === "webhook_only") {
    return input.hasWebhook ? "webhook" : "none";
  }

  if (input.policy === "official_only") {
    return input.hasOfficial ? "official" : "none";
  }

  if (input.policy === "session_only") {
    return input.hasSession ? "session" : "none";
  }

  if (input.policy === "prefer_session") {
    if (input.hasSession) return "session";
    if (input.hasWebhook) return "webhook";
    if (input.hasOfficial) return "official";
    return "none";
  }

  if (input.policy === "prefer_official") {
    if (input.hasOfficial) return "official";
    if (input.hasWebhook) return "webhook";
    if (input.hasSession) return "session";
    return "none";
  }

  // prefer_webhook (default live)
  if (input.hasWebhook) return "webhook";
  if (input.hasOfficial) return "official";
  if (input.hasSession) return "session";
  return "none";
}

export function parseConnectorPolicy(raw?: string | null): ConnectorPolicy {
  switch ((raw || "").trim()) {
    case "prefer_official":
    case "prefer_session":
    case "webhook_only":
    case "official_only":
    case "session_only":
    case "simulator_only":
    case "prefer_webhook":
      return raw as ConnectorPolicy;
    default:
      return "prefer_webhook";
  }
}
