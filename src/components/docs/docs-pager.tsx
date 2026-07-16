import Link from "next/link";
import type { DocsNavItem } from "@/data/docs";

export function DocsPager({
  prev,
  next,
}: {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
}) {
  if (!prev && !next) return null;

  return (
    <div className="mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="rounded-xl border p-4 transition-colors hover:bg-accent/40"
        >
          <div className="text-xs text-muted-foreground">Previous</div>
          <div className="mt-1 text-sm font-medium">{prev.title}</div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          className="rounded-xl border p-4 text-right transition-colors hover:bg-accent/40"
        >
          <div className="text-xs text-muted-foreground">Next</div>
          <div className="mt-1 text-sm font-medium">{next.title}</div>
        </Link>
      ) : null}
    </div>
  );
}
