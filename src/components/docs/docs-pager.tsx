import Link from "next/link";
import type { DocsNavItem } from "@/data/docs";
import { Card, CardContent } from "@/components/ui/card";

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
        <Link href={prev.href} className="block">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Previous</div>
              <div className="mt-1 text-sm font-medium">{prev.title}</div>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link href={next.href} className="block">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardContent className="p-4 text-right">
              <div className="text-xs text-muted-foreground">Next</div>
              <div className="mt-1 text-sm font-medium">{next.title}</div>
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </div>
  );
}