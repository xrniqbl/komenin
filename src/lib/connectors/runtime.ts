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
  type ConnectorSessionConfig,
  type ConnectorTarget,
} from "@/lib/connectors";
import { resolveSessionConfigForAccount } from "@/lib/connectors/session-runtime";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";

/**
 * Shared social action entry for workers (discover / send / rotate / health).
 *
 * Credential resolution mirrors the connector chain: workspace vault OAuth
 * token first, then an imported session cookie. Env tokens alone are not
 * enough once accounts connect via OAuth or via cookie import.
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
    session: await resolveSessionConfigForAccount({
      platform: target.platform,
      workspaceId,
      accountId: target.accountId,
    }),
    idempotencyKey: input.idempotencyKey ?? null,
  });
}

export type { ConnectorSessionConfig };
