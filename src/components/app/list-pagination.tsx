import Link from "next/link";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export type PageWindow = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  start: number;
  end: number;
};

export function getPageWindow(
  total: number,
  pageRaw: string | number | undefined,
  pageSize = 20,
): PageWindow {
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 0) / pageSize));
  const parsed = typeof pageRaw === "number" ? pageRaw : Number(pageRaw || 1);
  const page = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), totalPages) : 1;
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return { page, pageSize, total, totalPages, start, end };
}

export function paginateItems<T>(
  items: T[],
  pageRaw: string | number | undefined,
  pageSize = 20,
): { items: T[]; window: PageWindow } {
  const window = getPageWindow(items.length, pageRaw, pageSize);
  return {
    items: items.slice(window.start, window.end),
    window,
  };
}

function buildHref(
  pathname: string,
  searchParams: Record<string, string | undefined>,
  page: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (!value || key === "page") continue;
    params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function pageList(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }
  const sorted = Array.from(pages)
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const value = sorted[i]!;
    if (i > 0 && value - sorted[i - 1]! > 1) result.push("ellipsis");
    result.push(value);
  }
  return result;
}

export function ListPagination({
  pathname,
  searchParams = {},
  window,
}: {
  pathname: string;
  searchParams?: Record<string, string | undefined>;
  window: PageWindow;
}) {
  if (window.totalPages <= 1 || window.total === 0) return null;

  const prev = Math.max(1, window.page - 1);
  const next = Math.min(window.totalPages, window.page + 1);

  return (
    <div className="flex flex-col items-center gap-3 border-t px-4 py-4 sm:flex-row sm:justify-between">
      <div className="text-xs text-muted-foreground">
        Showing {window.start + 1}-{window.end} of {window.total}
      </div>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              render={<Link href={buildHref(pathname, searchParams, prev)} />}
              aria-disabled={window.page <= 1}
              className={window.page <= 1 ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
          {pageList(window.page, window.totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`e-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  isActive={item === window.page}
                  render={<Link href={buildHref(pathname, searchParams, item)} />}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              render={<Link href={buildHref(pathname, searchParams, next)} />}
              aria-disabled={window.page >= window.totalPages}
              className={window.page >= window.totalPages ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
