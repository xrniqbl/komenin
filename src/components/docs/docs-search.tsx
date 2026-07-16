"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getDocsSearchIndex } from "@/data/docs";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@/components/ui/autocomplete";

type DocsSearchItem = ReturnType<typeof getDocsSearchIndex>[number];

export function DocsSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const index = useMemo(() => getDocsSearchIndex(), []);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.slice(0, 8);
    return index
      .filter((item) =>
        `${item.title} ${item.description} ${item.group}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [index, query]);

  return (
    <div className="relative mb-5">
      <Autocomplete
        items={results}
        value={query}
        onValueChange={(value) => setQuery(String(value ?? ""))}
        itemToStringValue={(item) => String((item as DocsSearchItem).title || "")}
        filter={null}
      >
        <AutocompleteInput
          placeholder="Search docs..."
          showClear={query.length > 0}
          startAddon={<Search className="size-4" />}
        />
        <AutocompletePopup>
          <AutocompleteEmpty>No matches</AutocompleteEmpty>
          <AutocompleteList>
            {results.map((item) => (
              <AutocompleteItem
                key={item.href}
                value={item}
                onClick={() => {
                  setQuery("");
                  router.push(item.href);
                }}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.group} · {item.description}
                  </span>
                </div>
              </AutocompleteItem>
            ))}
          </AutocompleteList>
        </AutocompletePopup>
      </Autocomplete>
    </div>
  );
}
