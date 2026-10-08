"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publishDueContentDrafts } from "@/server/content-campaigns";

export function ContentPageActions() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="glass"
      disabled={pending}
      onClick={() => startTransition(async () => { await publishDueContentDrafts(); })}
    >
      {pending ? "..." : "Publish due posts"}
    </Button>
  );
}
