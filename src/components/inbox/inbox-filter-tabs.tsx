"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

function buildHref(
  pathname: string,
  searchParams: URLSearchParams,
  key: string,
  value: string,
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (!value) params.delete(key);
  else params.set(key, value);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function InboxFilterTabs({
  statuses,
  platforms,
  activeStatus,
  activePlatform,
  counts,
}: {
  statuses: Option[];
  platforms: Option[];
  activeStatus: string;
  activePlatform: string;
  counts: { total: number; drafted: number; undrafted: number };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  function go(href: string) {
    startTransition(() => router.push(href));
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Inbox status filter">
        {statuses.map((option) => {
          const active = (activeStatus || "all") === option.value;
          return (
            <Button
              key={option.value}
              size="sm"
              variant={active ? "default" : "outline"}
              aria-current={active ? "page" : undefined}
              className={cn(active && "pointer-events-none")}
              render={
                <Link
                  href={buildHref(pathname, searchParams, "status", option.value === "all" ? "" : option.value)}
                  onClick={(e) => {
                    e.preventDefault();
                    go(buildHref(pathname, searchParams, "status", option.value === "all" ? "" : option.value));
                  }}
                />
              }
              nativeButton={false}
            >
              {option.label}
              {option.value === "all" ? ` (${counts.total})` : ""}
            </Button>
          );
        })}
        <span className="ml-2 text-xs text-muted-foreground">
          {counts.drafted} drafted · {counts.undrafted} awaiting draft
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Inbox platform filter">
        <span className="text-xs text-muted-foreground">Platform:</span>
        {platforms.map((option) => {
          const active = (activePlatform || "all") === option.value;
          return (
            <Button
              key={option.value}
              size="sm"
              variant={active ? "default" : "outline"}
              aria-current={active ? "page" : undefined}
              className={cn(active && "pointer-events-none", "h-7 text-xs")}
              render={
                <Link
                  href={buildHref(pathname, searchParams, "platform", option.value === "all" ? "" : option.value)}
                  onClick={(e) => {
                    e.preventDefault();
                    go(buildHref(pathname, searchParams, "platform", option.value === "all" ? "" : option.value));
                  }}
                />
              }
              nativeButton={false}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
