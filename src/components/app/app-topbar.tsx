"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppCommandPalette } from "@/components/app/app-command-palette";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import type { WorkspaceSummary } from "@/types/workspace";

export function AppTopbar({
  workspace,
  workspaces,
  userEmail,
}: {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  userEmail?: string | null;
}) {
  const initials = (userEmail || "A").slice(0, 2).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger render={<SidebarTrigger className="-ms-1" />} />
          <TooltipPopup>Toggle sidebar</TooltipPopup>
        </Tooltip>
        <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />
        <div className="hidden min-w-0 flex-col sm:flex">
          <span className="text-xs text-muted-foreground">Workspace</span>
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{workspace.name}</span>
            <Badge variant="secondary">{workspace.role}</Badge>
          </div>
        </div>
        <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={workspace.id} />
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <AppCommandPalette />
        <span className="hidden text-sm text-muted-foreground lg:inline">{userEmail}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex">
                <Avatar className="size-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </span>
            }
          />
          <TooltipPopup>{userEmail || "Signed in"}</TooltipPopup>
        </Tooltip>
      </div>
    </header>
  );
}