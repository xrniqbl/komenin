import type { WorkspaceRole } from "@/types/workspace";

export type Permission =
  | "billing.manage"
  | "members.manage"
  | "accounts.manage"
  | "campaigns.manage"
  | "agents.manage"
  | "skills.manage"
  | "analytics.view"
  | "audit.view"
  | "audit.export"
  | "settings.manage";

const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: [
    "billing.manage",
    "members.manage",
    "accounts.manage",
    "campaigns.manage",
    "agents.manage",
    "skills.manage",
    "analytics.view",
    "audit.view",
    "audit.export",
    "settings.manage",
  ],
  admin: [
    "members.manage",
    "accounts.manage",
    "campaigns.manage",
    "agents.manage",
    "skills.manage",
    "analytics.view",
    "audit.view",
    "audit.export",
    "settings.manage",
  ],
  operator: [
    "accounts.manage",
    "campaigns.manage",
    "agents.manage",
    "skills.manage",
    "analytics.view",
  ],
  analyst: ["analytics.view"],
  auditor: ["analytics.view", "audit.view", "audit.export"],
  viewer: ["analytics.view"],
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertCan(role: WorkspaceRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: ${role} cannot ${permission}`);
  }
}
