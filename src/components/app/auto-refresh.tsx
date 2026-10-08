"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** Poll the current route at an interval so new data appears without manual refresh.
 *  Pauses when the tab is hidden to save resources. */
export function useAutoRefresh(intervalMs = 15000) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);

  React.useEffect(() => {
    function tick() {
      if (document.hidden) return;
      router.refresh();
      setLastRefresh(new Date());
    }
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return lastRefresh;
}

export function AutoRefreshIndicator({ intervalMs = 15000 }: { intervalMs?: number }) {
  const lastRefresh = useAutoRefresh(intervalMs);

  return (
    <span className="text-xs text-muted-foreground" title="Auto-refresh active">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
      Live
      {lastRefresh
        ? ` · updated ${lastRefresh.toLocaleTimeString()}`
        : ""}
    </span>
  );
}
