"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AuthenticatedAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Authenticated app error", error.digest || error.name);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight">This view failed to load</h1>
      <p className="text-sm text-muted-foreground">
        Your workspace data is safe. Retry this screen, or open another section from the sidebar.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Retry
        </Button>
        <Button type="button" variant="outline" onClick={() => (window.location.href = "/app")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}
