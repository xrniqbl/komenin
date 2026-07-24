"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { captureLeadFromApproval } from "@/server/leads";

export function CaptureLeadButton({ approvalId }: { approvalId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="min-h-10 w-full sm:min-h-9 sm:w-auto"
      onClick={() =>
        startTransition(async () => {
          await captureLeadFromApproval({
            approvalId,
            intent: "Captured from approval queue",
          });
        })
      }
    >
      {pending ? "Saving lead…" : "Save as lead"}
    </Button>
  );
}