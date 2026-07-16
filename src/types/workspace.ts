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
  | "webhook_only"
  | "official_only"
  | "simulator_only";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  connectorPolicy: ConnectorPolicy;
  planCode: string;
  monthlySendLimit: number;
  monthlyPublishLimit: number;
  homeRegion: string;
  ssoRequired: boolean;
  billingEmail?: string | null;
};
