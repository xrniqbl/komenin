"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import { toastManager } from "@/components/ui/toast";
import {
  duplicateContentCampaign,
  setContentCampaignStatus,
} from "@/server/content-campaigns";

export function ContentCampaignRowActions({
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
            variant="glass"
            size="icon-sm"
            disabled={pending}
            aria-label="Auto post campaign actions"
          />
        }
      >
        <MoreHorizRoundedIcon className="size-4" />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuItem
          disabled={pending}
          onClick={() => run("Campaign duplicated", () => duplicateContentCampaign({ campaignId }))}
        >
          Duplicate
        </MenuItem>
        {status === "active" ? (
          <MenuItem
            disabled={pending}
            onClick={() =>
              run("Campaign paused", () => setContentCampaignStatus({ campaignId, status: "paused" }))
            }
          >
            Pause
          </MenuItem>
        ) : null}
        {status === "paused" || status === "draft" || status === "generating" ? (
          <MenuItem
            disabled={pending}
            onClick={() =>
              run("Campaign activated", () => setContentCampaignStatus({ campaignId, status: "active" }))
            }
          >
            Activate
          </MenuItem>
        ) : null}
        {status !== "completed" ? (
          <MenuItem
            disabled={pending}
            onClick={() =>
              run("Campaign archived", () => setContentCampaignStatus({ campaignId, status: "completed" }))
            }
          >
            Archive
          </MenuItem>
        ) : (
          <MenuItem
            disabled={pending}
            onClick={() =>
              run("Campaign reopened", () => setContentCampaignStatus({ campaignId, status: "active" }))
            }
          >
            Reopen
          </MenuItem>
        )}
      </MenuPopup>
    </Menu>
  );
}
