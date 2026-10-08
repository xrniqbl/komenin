"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { captureLeadFromTargetPost } from "@/server/leads";

export function InboxCaptureButton({ targetPostId }: { targetPostId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="glass"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await captureLeadFromTargetPost({
            targetPostId,
            intent: "Captured from inbox",
          });
        })
      }
    >
      {pending ? "Saving…" : "Save as lead"}
    </Button>
  );
}
