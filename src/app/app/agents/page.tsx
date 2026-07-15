import { PageHeader } from "@/components/app/page-header";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Agents"
        description="Module shell ready. Full implementation lands in the next foundation follow-on plan."
      />
      <div className="rounded-2xl border border bg-background p-6 text-sm text-muted-foreground">
        Placeholder route for Agents. Data model and IA are prepared.
      </div>
    </div>
  );
}
