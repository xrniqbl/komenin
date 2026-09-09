import {
  getDefaultConnectorPolicy,
  getDefaultWebhookConfig,
  resolveOfficialConfigForPublish,
} from "@/lib/publish-connector";
import {
  runConnectorAction,
  type ConnectorAction,
  type ConnectorActionPayload,
  type ConnectorResult,
  type ConnectorTarget,
} from "@/lib/connectors";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";

/**
 * Shared social action entry for workers (discover / send / rotate / health).
 * Resolves workspace vault OAuth credentials the same way publish does — env
 * tokens alone are not enough once accounts connect via OAuth.
 */
export async function executeSocialAction(input: {
  action: ConnectorAction;
  target: ConnectorTarget;
  payload: ConnectorActionPayload;
  forceMode?: "simulator" | "live";
  policy?: string | null;
  /** Prefer explicit workspace; falls back to target.workspaceId. */
  workspaceId?: string | null;
  /** Dedup key for mutating actions (see ConnectorActionInput). */
  idempotencyKey?: string | null;
}): Promise<ConnectorResult> {
  const workspaceId = input.workspaceId ?? input.target.workspaceId ?? null;
  const target: ConnectorTarget = {
    ...input.target,
    workspaceId: workspaceId ?? input.target.workspaceId,
  };

  return runConnectorAction({
    action: input.action,
    runtimeMode: input.forceMode || getRuntimeModeLabel(),
    policy: getDefaultConnectorPolicy(input.policy),
    target,
    payload: input.payload,
    webhook: getDefaultWebhookConfig(),
    official: await resolveOfficialConfigForPublish({
      platform: target.platform,
      workspaceId,
      accountId: target.accountId,
    }),
    idempotencyKey: input.idempotencyKey ?? null,
  });
}
