"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";

const NAV_GROUPS = [
  {
    label: "Command Center",
    items: [{ label: "Overview", href: "/app", shortcut: "G O" }],
  },
  {
    label: "Session Routing",
    items: [
      { label: "Accounts", href: "/app/accounts", shortcut: "G A" },
      { label: "Proxies", href: "/app/proxies", shortcut: "G P" },
      { label: "Sessions", href: "/app/sessions", shortcut: "G S" },
    ],
  },
  {
    label: "Automation",
    items: [
      { label: "Campaigns", href: "/app/campaigns" },
      { label: "Auto Posts", href: "/app/content" },
      { label: "Templates", href: "/app/templates" },
      { label: "Listeners", href: "/app/listeners" },
      { label: "Inbox", href: "/app/inbox" },
      { label: "Approvals", href: "/app/approvals" },
      { label: "Activity", href: "/app/activity" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Agents", href: "/app/agents" },
      { label: "Skills", href: "/app/skills" },
      { label: "Runs", href: "/app/runs" },
      { label: "Competitor Radar", href: "/app/competitors" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Analytics", href: "/app/analytics" },
      { label: "Rate Limits", href: "/app/rate-limits" },
      { label: "Audit Logs", href: "/app/audit-logs" },
      { label: "Notifications", href: "/app/notifications" },
      { label: "Settings", href: "/app/settings" },
    ],
  },
] as const;

const FLAT_ITEMS = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
);

export function AppCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FLAT_ITEMS;
    return FLAT_ITEMS.filter((item) =>
      `${item.label} ${item.group} ${item.href}`.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden min-w-48 justify-between gap-3 text-muted-foreground md:inline-flex"
        onClick={() => setOpen(true)}
      >
        <span className="inline-flex items-center gap-2">
          <SearchIcon className="size-4" />
          Search…
        </span>
        <Kbd>⌘K</Kbd>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="md:hidden"
        aria-label="Open command palette"
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="size-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogPopup>
          <Command
            items={filtered}
            value={query}
            onValueChange={(value) => setQuery(String(value ?? ""))}
            itemToStringValue={(item) => String((item as { label?: string }).label || "")}
            filter={null}
          >
            <CommandInput placeholder="Jump to a page…" />
            <CommandPanel>
              <CommandList>
                <CommandEmpty>No results</CommandEmpty>
                {grouped.map(([group, items]) => (
                  <CommandGroup key={group}>
                    <CommandGroupLabel>{group}</CommandGroupLabel>
                    {items.map((item) => (
                      <CommandItem
                        key={item.href}
                        value={item}
                        onClick={() => go(item.href)}
                      >
                        <span>{item.label}</span>
                        {"shortcut" in item && item.shortcut ? (
                          <CommandShortcut>{item.shortcut}</CommandShortcut>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </CommandPanel>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </>
  );
}
