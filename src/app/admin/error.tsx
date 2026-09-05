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
        <CardTitle className="text-base">Terjadi kesalahan di panel admin</CardTitle>
        <CardDescription>
          Query ini gagal dijalankan. Coba lagi; jika berulang, periksa log server
          {error.digest ? ` (digest ${error.digest})` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={reset}>
          Coba lagi
        </Button>
      </CardContent>
    </Card>
  );
}
