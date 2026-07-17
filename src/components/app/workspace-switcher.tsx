"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchActiveWorkspace } from "@/server/active-workspace";
import type { WorkspaceSummary } from "@/types/workspace";

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (workspaces.length <= 1) return null;

  return (
    <Select
      value={activeWorkspaceId}
      disabled={pending}
      onValueChange={(value) => {
        if (!value || value === activeWorkspaceId) return;
        startTransition(async () => {
          await switchActiveWorkspace(String(value));
          router.refresh();
        });
      }}
      items={workspaces.map((workspace) => ({
        value: workspace.id,
        label: workspace.name,
      }))}
    >
      <SelectTrigger className="h-8 min-w-[10rem] max-w-[14rem]" size="sm">
        <SelectValue placeholder="Workspace" />
      </SelectTrigger>
      <SelectPopup>
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id} label={workspace.name}>
            <div className="flex flex-col">
              <span>{workspace.name}</span>
              <span className="text-[10px] text-muted-foreground">/{workspace.slug}</span>
            </div>
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}