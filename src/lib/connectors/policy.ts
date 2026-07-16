import type {
  ConnectorAction,
  ConnectorKind,
  ConnectorPolicy,
  RuntimeMode,
} from "@/lib/connectors/types";

export function resolveConnectorKind(input: {
  runtimeMode: RuntimeMode;
  policy: ConnectorPolicy;
  hasWebhook: boolean;
  hasOfficial: boolean;
  action: ConnectorAction;
}): ConnectorKind {
  if (input.runtimeMode === "simulator" || input.policy === "simulator_only") {
    return "simulator";
  }

  if (input.policy === "webhook_only") {
    return input.hasWebhook ? "webhook" : "none";
  }

  if (input.policy === "official_only") {
    return input.hasOfficial ? "official" : "none";
  }

  if (input.policy === "prefer_official") {
    if (input.hasOfficial) return "official";
    if (input.hasWebhook) return "webhook";
    return "none";
  }

  // prefer_webhook (default live)
  if (input.hasWebhook) return "webhook";
  if (input.hasOfficial) return "official";
  return "none";
}

export function parseConnectorPolicy(raw?: string | null): ConnectorPolicy {
  switch ((raw || "").trim()) {
    case "prefer_official":
    case "webhook_only":
    case "official_only":
    case "simulator_only":
    case "prefer_webhook":
      return raw as ConnectorPolicy;
    default:
      return "prefer_webhook";
  }
}
