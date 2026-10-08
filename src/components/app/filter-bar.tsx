"use client";

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FilterOption = { value: string; label: string };

type Props = {
  placeholder?: string;
  statusOptions?: FilterOption[];
  platformOptions?: FilterOption[];
  queryParam?: string;
  statusParam?: string;
  platformParam?: string;
  defaultQ?: string;
  defaultStatus?: string;
  defaultPlatform?: string;
  className?: string;
};

export function FilterBar({
  placeholder = "Search...",
  statusOptions,
  platformOptions,
  queryParam = "q",
  statusParam = "status",
  platformParam = "platform",
  defaultQ = "",
  defaultStatus = "",
  defaultPlatform = "",
  className,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(defaultQ);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setQ(searchParams.get(queryParam) ?? "");
  }, [searchParams, queryParam]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (q === (searchParams.get(queryParam) ?? "")) return;
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (q) params.set(queryParam, q);
        else params.delete(queryParam);
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);
    return () => clearTimeout(timer);
    // Debounced on `q` only; URL state is read when the timer fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const updateFilter = (key: string, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const clearAll = () => {
    setQ("");
    startTransition(() => {
      router.replace(pathname);
    });
  };

  const hasFilters = !!q || !!defaultStatus || !!defaultPlatform;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <InputGroup className="h-8 min-w-0 w-full flex-1 basis-full sm:min-w-[200px] sm:basis-auto">
        <InputGroupAddon
          align="inline-start"
          className="pointer-events-none h-full shrink-0 self-stretch ps-2.5 pe-0 text-muted-foreground"
        >
          <SearchRoundedIcon className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          size="sm"
          className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 pe-2.5 ps-1.5 text-sm shadow-none focus-visible:ring-0"
        />
      </InputGroup>

      {statusOptions && statusOptions.length > 0 ? (
        <div className="w-full sm:w-auto">
          <Select
            value={defaultStatus || "__all"}
            onValueChange={(v) => updateFilter(statusParam, v === "__all" || !v ? "" : v)}
          >
            <SelectTrigger className="h-8 w-full text-sm sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="__all">All status</SelectItem>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      ) : null}

      {platformOptions && platformOptions.length > 0 ? (
        <div className="w-full sm:w-auto">
          <Select
            value={defaultPlatform || "__all"}
            onValueChange={(v) => updateFilter(platformParam, v === "__all" || !v ? "" : v)}
          >
            <SelectTrigger className="h-8 w-full text-sm sm:w-[140px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="__all">All platforms</SelectItem>
              {platformOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      ) : null}

      <Popover>
        <PopoverTrigger render={<Button size="sm" variant="glass" className="h-8" />}>
          Tips
        </PopoverTrigger>
        <PopoverPopup className="w-72 p-4" align="end">
          <PopoverTitle className="text-sm">Filter tips</PopoverTitle>
          <PopoverDescription className="mt-2 space-y-1 text-xs">
            <div>SearchRoundedIcon updates as you type.</div>
            <div>Status/platform filters reset pagination to page 1.</div>
            <div>Use Clear to remove all active filters.</div>
          </PopoverDescription>
        </PopoverPopup>
      </Popover>

      {hasFilters ? (
        <Button size="sm" variant="glass" className="h-8 gap-1" onClick={clearAll}>
          <CloseRoundedIcon className="size-3.5 shrink-0" />
          Clear
        </Button>
      ) : null}

      {isPending ? <span className="text-xs text-muted-foreground">Filtering...</span> : null}
    </div>
  );
}
