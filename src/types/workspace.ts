export type WorkspaceRole =
  | "owner"
  | "admin"
  | "operator"
  | "analyst"
  | "auditor"
  | "viewer";

export type ConnectorPolicy =
  | "prefer_official"
  | "prefer_webhook"
  | "prefer_session"
  | "webhook_only"
  | "official_only"
  | "session_only"
  | "simulator_only";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  /** Custom role permission keys when membership.customRoleId is set. */
  customPermissions?: string[] | null;
  customRoleId?: string | null;
  connectorPolicy: ConnectorPolicy;
  planCode: string;
  monthlySendLimit: number;
  monthlyPublishLimit: number;
  homeRegion: string;
  ssoRequired: boolean;
  billingEmail?: string | null;
};
