"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import { toastManager } from "@/components/ui/toast";
import {
  duplicateCampaign,
  setCampaignStatus,
} from "@/server/campaigns";

export function CampaignRowActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(label: string, fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        toastManager.add({ title: label, type: "success" });
        router.refresh();
      } catch (error) {
        toastManager.add({
          title: label,
          description: error instanceof Error ? error.message : "Action failed",
          type: "error",
        });
      }
    });
  }

  return (
    <Menu>
      <MenuTrigger
        disabled={pending}
        className="inline-flex"
        render={
          <Button
            variant="outline"
            size="icon-sm"
            disabled={pending}
            aria-label="Campaign actions"
          />
        }
      >
        <MoreHorizontalIcon className="size-4" />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuItem
          disabled={pending}
          onClick={() => run("Campaign duplicated", () => duplicateCampaign({ campaignId }))}
        >
          Duplicate
        </MenuItem>
        {status === "active" ? (
          <MenuItem
            disabled={pending}
            onClick={() => run("Campaign paused", () => setCampaignStatus({ campaignId, status: "paused" }))}
          >
            Pause
          </MenuItem>
        ) : null}
        {status === "paused" || status === "draft" ? (
          <MenuItem
            disabled={pending}
            onClick={() => run("Campaign activated", () => setCampaignStatus({ campaignId, status: "active" }))}
          >
            Activate
          </MenuItem>
        ) : null}
        {status !== "completed" ? (
          <MenuItem
            disabled={pending}
            onClick={() => run("Campaign archived", () => setCampaignStatus({ campaignId, status: "completed" }))}
          >
            Archive
          </MenuItem>
        ) : (
          <MenuItem
            disabled={pending}
            onClick={() => run("Campaign reopened", () => setCampaignStatus({ campaignId, status: "active" }))}
          >
            Reopen
          </MenuItem>
        )}
      </MenuPopup>
    </Menu>
  );
}
