"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  bulkApproveContentDrafts,
  generateContentCampaignDrafts,
  publishDueContentDrafts,
} from "@/server/content-campaigns";

export function ContentCampaignActions({
  campaignId,
  pendingCount,
}: {
  campaignId: string;
  pendingCount: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="glass"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await generateContentCampaignDrafts(campaignId);
          })
        }
      >
        Regenerate drafts
      </Button>
      <Button
        variant="glass"
        disabled={pending || pendingCount === 0}
        onClick={() =>
          startTransition(async () => {
            await bulkApproveContentDrafts({ campaignId });
          })
        }
      >
        Bulk approve pending ({pendingCount})
      </Button>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await publishDueContentDrafts();
          })
        }
      >
        {pending ? "..." : "Publish due posts"}
      </Button>
    </div>
  );
}
