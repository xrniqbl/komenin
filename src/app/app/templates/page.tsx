import Link from "next/link";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { listCommentTemplates } from "@/server/templates";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const templates = await listCommentTemplates({
    q: params.q,
    category: params.category,
  });

  return (
    <div>
      <PageHeader
        title="Reply Templates"
        description="Reusable comment templates with {{variables}} for personalized replies."
        action={
          <Button render={<Link href="/app/templates/new" />} nativeButton={false}>
            New template
          </Button>
        }
      />

      <div className="mb-4">
        <FilterBar placeholder="Search templates..." defaultQ={params.q || ""} />
      </div>

      {templates.length === 0 ? (
        <div className="rounded-2xl border bg-background">
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No templates yet</EmptyTitle>
              <EmptyDescription>Create your first reply template with variables.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link href="/app/templates/new" />} nativeButton={false}>
                Create template
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/app/templates/${t.id}`}
              className="block rounded-2xl border bg-background p-4 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold">{t.name}</div>
                <Badge variant={t.isActive ? "secondary" : "outline"} className="text-[10px]">
                  {t.isActive ? "active" : "inactive"}
                </Badge>
              </div>
              <div className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{t.body}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {t.category}
                </Badge>
                {t.variables.slice(0, 3).map((v) => (
                  <Badge key={v} variant="outline" className="text-[9px] font-mono">
                    {`{{${v}}}`}
                  </Badge>
                ))}
                {t.variables.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">+{t.variables.length - 3} more</span>
                ) : null}
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                {t.usageCount} uses · updated {new Date(t.updatedAt).toISOString().slice(0, 10)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
