"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] page error:", error);
  }, [error]);

  return (
    <Card className="max-w-xl border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base">Something went wrong in the admin panel</CardTitle>
        <CardDescription>
          This query failed to run. Try again; if it persists, check the server logs
          {error.digest ? ` (digest ${error.digest})` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
