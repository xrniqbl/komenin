export type WorkspaceRole =
  | "owner"
  | "admin"
  | "operator"
  | "analyst"
  | "auditor"
  | "viewer";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};
