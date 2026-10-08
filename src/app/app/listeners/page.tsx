import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { ListPagination, paginateItems } from "@/components/app/list-pagination";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages } from "@/lib/i18n/messages";
import { listListeners } from "@/server/listeners";
import { ListenersTable } from "@/components/listeners/listeners-table";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "tiktok", label: "TikTok" },
];

export default async function ListenersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; platform?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const t = messages[locale].listeners;

  const q = (params.q || "").trim();
  const platform = (params.platform || "").trim();
  const status = (params.status || "").trim();

  const listeners = await listListeners({
    q: q || undefined,
    platform: platform || undefined,
    status: status || undefined,
  });
  const { items, window } = paginateItems(listeners, params.page, 20);

  // Preserve filter params across detail navigation and pagination links so a
  // back-navigation lands on the same filtered view.
  const preserve: Record<string, string | undefined> = {
    q: q || undefined,
    platform: platform || undefined,
    status: status || undefined,
  };
  const preserveQs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(preserve).filter((entry): entry is [string, string] => !!entry[1]),
    ),
  ).toString();

  const hasFilters = !!q || !!platform || !!status;

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Button variant="electric" render={<Link href="/app/listeners/new" />} nativeButton={false}>
            {t.newListener}
          </Button>
        }
      />
      <div className="mb-4">
        <FilterBar
          placeholder={t.searchPlaceholder}
          statusOptions={STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: o.value === "active" ? t.statusActive : t.statusPaused,
          }))}
          platformOptions={PLATFORM_OPTIONS}
          defaultQ={q}
          defaultStatus={status}
          defaultPlatform={platform}
        />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {listeners.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>{hasFilters ? t.emptyFilteredTitle : t.emptyTitle}</EmptyTitle>
              <EmptyDescription>
                {hasFilters ? t.emptyFilteredDescription : t.emptyDescription}
              </EmptyDescription>
            </EmptyHeader>
            {!hasFilters ? (
              <EmptyContent>
                <Button render={<Link href="/app/listeners/new" />} nativeButton={false}>
                  {t.newListener}
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <>
            <ListenersTable listeners={items} locale={locale} preserveParams={preserveQs} />
            <ListPagination
              pathname="/app/listeners"
              searchParams={preserve}
              window={window}
            />
          </>
        )}
      </Card>
    </div>
  );
}
