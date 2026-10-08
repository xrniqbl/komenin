"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

import { Button } from "@/components/ui/button";
import { generateDraftForPost } from "@/server/comment-pipeline";

export function InboxGenerateDraftButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await generateDraftForPost(postId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate draft");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="glass"
        size="sm"
        onClick={handleClick}
        disabled={pending}
        className="gap-1.5"
      >
        <AutoAwesomeRoundedIcon className="h-3.5 w-3.5" />
        {pending ? "Generating..." : "Generate draft"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
