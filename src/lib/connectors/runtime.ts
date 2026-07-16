import {
  getDefaultConnectorPolicy,
  getDefaultOfficialConfig,
  getDefaultWebhookConfig,
} from "@/lib/publish-connector";
import {
  runConnectorAction,
  type ConnectorAction,
  type ConnectorActionPayload,
  type ConnectorResult,
  type ConnectorTarget,
} from "@/lib/connectors";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";

export async function executeSocialAction(input: {
  action: ConnectorAction;
  target: ConnectorTarget;
  payload: ConnectorActionPayload;
  forceMode?: "simulator" | "live";
  policy?: string | null;
}): Promise<ConnectorResult> {
  return runConnectorAction({
    action: input.action,
    runtimeMode: input.forceMode || getRuntimeModeLabel(),
    policy: getDefaultConnectorPolicy(input.policy),
    target: input.target,
    payload: input.payload,
    webhook: getDefaultWebhookConfig(),
    official: getDefaultOfficialConfig(input.target.platform),
  });
}
