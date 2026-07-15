import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { WorkspaceSummary } from "@/types/workspace";

export function AppTopbar({
  workspace,
  userEmail,
}: {
  workspace: WorkspaceSummary;
  userEmail?: string | null;
}) {
  const initials = (userEmail || "A").slice(0, 2).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Workspace</span>
        <span className="text-sm font-semibold">{workspace.name}</span>
        <Badge variant="secondary">{workspace.role}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{userEmail}</span>
        <Avatar className="size-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
