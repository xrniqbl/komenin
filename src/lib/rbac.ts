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

export const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
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

export const PERMISSION_DEFINITIONS: { key: Permission; label: string; group: string }[] = [
  { key: "billing.manage", label: "Manage billing & subscriptions", group: "Billing" },
  { key: "members.manage", label: "Invite & manage team members", group: "Team" },
  { key: "accounts.manage", label: "Connect & manage social accounts", group: "Accounts" },
  { key: "campaigns.manage", label: "Create & manage campaigns & content", group: "Campaigns" },
  { key: "agents.manage", label: "Manage agents & knowledge", group: "Intelligence" },
  { key: "skills.manage", label: "Manage skills & executions", group: "Intelligence" },
  { key: "analytics.view", label: "View analytics & activity", group: "Analytics" },
  { key: "audit.view", label: "View audit logs", group: "Audit" },
  { key: "audit.export", label: "Export audit logs as CSV", group: "Audit" },
  { key: "settings.manage", label: "Manage workspace settings & integrations", group: "Settings" },
];

export function can(role: WorkspaceRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function canWithCustom(
  role: WorkspaceRole,
  customPermissions: string[] | null | undefined,
  permission: Permission,
): boolean {
  // Owner always retains full system permissions.
  if (role === "owner") return can(role, permission);
  if (customPermissions && customPermissions.length > 0) {
    return customPermissions.includes(permission);
  }
  return can(role, permission);
}

export function assertCan(role: WorkspaceRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: ${role} cannot ${permission}`);
  }
}

export function assertCanWithCustom(
  role: WorkspaceRole,
  customPermissions: string[] | null | undefined,
  permission: Permission,
): void {
  if (!canWithCustom(role, customPermissions, permission)) {
    throw new Error(`Forbidden: ${role} cannot ${permission}`);
  }
}

/** Prefer this for workspace-scoped server actions — honors custom role permissions. */
export function assertWorkspacePermission(
  workspace: { role: WorkspaceRole; customPermissions?: string[] | null },
  permission: Permission,
): void {
  assertCanWithCustom(workspace.role, workspace.customPermissions, permission);
}

export function resolvePermissions(
  role: WorkspaceRole,
  customPermissions?: string[] | null,
): Permission[] {
  if (role === "owner") return ROLE_PERMISSIONS.owner;
  if (customPermissions && customPermissions.length > 0) {
    return customPermissions as Permission[];
  }
  return ROLE_PERMISSIONS[role] || [];
}
