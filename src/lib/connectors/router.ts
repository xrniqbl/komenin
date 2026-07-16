import { resolveConnectorKind } from "@/lib/connectors/policy";
import { runOfficialConnector } from "@/lib/connectors/official";
import { runSimulatorConnector } from "@/lib/connectors/simulator";
import type {
  ConnectorActionInput,
  ConnectorResult,
} from "@/lib/connectors/types";
import { runWebhookConnector } from "@/lib/connectors/webhook";

export async function runConnectorAction(
  input: ConnectorActionInput,
): Promise<ConnectorResult> {
  const hasWebhook = Boolean(input.webhook?.url);
  const hasOfficial = Boolean(input.official?.accessToken);
  const kind = resolveConnectorKind({
    runtimeMode: input.runtimeMode,
    policy: input.policy,
    hasWebhook,
    hasOfficial,
    action: input.action,
  });

  if (kind === "simulator") {
    return runSimulatorConnector(input);
  }
  if (kind === "webhook") {
    return runWebhookConnector(input);
  }
  if (kind === "official") {
    return runOfficialConnector(input);
  }

  return {
    ok: false,
    mode: input.runtimeMode,
    connector: "none",
    message:
      "Live connector is not configured (fail closed). Provide webhook URL or official API credentials.",
    details: {
      policy: input.policy,
      action: input.action,
      hasWebhook,
      hasOfficial,
    },
  };
}

export { resolveConnectorKind, parseConnectorPolicy } from "@/lib/connectors/policy";
export * from "@/lib/connectors/types";
