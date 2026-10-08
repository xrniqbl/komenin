"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import { useLocale } from "@/components/i18n/locale-provider";
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
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const index = useMemo(() => getDocsSearchIndex(locale), [locale]);
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
          placeholder={t.docsUi.searchPlaceholder}
          size="sm"
          showClear={query.length > 0}
          startAddon={<SearchRoundedIcon className="size-3.5 shrink-0 text-neutral-500" aria-hidden="true" />}
          className="rounded-full border-white/10 bg-white/5 text-white backdrop-blur-xl placeholder:text-neutral-500 hover:border-white/20 focus-visible:border-electric-500/50"
        />
        <AutocompletePopup className="border-white/10 bg-[#0A0F1E]/95 text-white shadow-xl shadow-black/40 backdrop-blur-xl">
          <AutocompleteEmpty className="text-neutral-500">{t.docsUi.noMatches}</AutocompleteEmpty>
          <AutocompleteList>
            {results.map((item) => (
              <AutocompleteItem
                key={item.href}
                value={item}
                onClick={() => {
                  setQuery("");
                  router.push(item.href);
                }}
                className="rounded-lg data-highlighted:bg-white/10 data-highlighted:text-white"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-white">{item.title}</span>
                  <span className="truncate text-xs text-neutral-500">
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
