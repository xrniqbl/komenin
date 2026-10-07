import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listSkillRuns, retrySkillRun } from "@/server/skills";

const RUN_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  running: "secondary",
  succeeded: "default",
  failed: "destructive",
  cancelled: "outline",
};

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status || "").trim();
  const runs = await listSkillRuns(100, status ? { status } : undefined);

  async function retryAction(formData: FormData) {
    "use server";
    const runId = String(formData.get("runId") || "");
    if (!runId) return;
    await retrySkillRun(runId);
    redirect("/app/runs");
  }

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Skill execution timeline with chain-of-thought steps. Skill runs execute locally or via webhook and do not consume AI credits — AI spend lives under Analytics → AI usage."
        action={<Link href="/app/skills" className="text-sm text-primary hover:underline">Manage skills</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Status:</span>
        {RUN_STATUS_OPTIONS.map((option) => {
          const active =
            (option.value === "" && !status) || option.value === status;
          const href =
            option.value === ""
              ? "/app/runs"
              : `/app/runs?status=${encodeURIComponent(option.value)}`;
          return (
            <Button
              key={option.value || "__all"}
              size="sm"
              variant={active ? "default" : "outline"}
              render={
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(active && "pointer-events-none")}
                />
              }
              nativeButton={false}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
      <div className="space-y-3">
        {runs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No runs yet</CardTitle>
              <CardDescription>
                {status
                  ? `No ${status} runs. Clear the filter or execute a skill from /app/skills.`
                  : "Execute a skill from /app/skills or let comment generation trigger one."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          runs.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {run.skill.name}{" "}
                    <Badge variant={STATUS_VARIANT[run.status] || "secondary"}>
                      {run.status}
                    </Badge>
                  </CardTitle>
                  {run.status === "failed" || run.status === "cancelled" ? (
                    <form action={retryAction}>
                      <input type="hidden" name="runId" value={run.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Retry
                      </Button>
                    </form>
                  ) : null}
                </div>
                <CardDescription>
                  {run.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                  {run.agent ? ` · agent ${run.agent.name}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {run.steps.map((step) => (
                  <div key={step.id} className="glass rounded-xl border-white/10 p-3">
                    <div className="font-medium">
                      {step.ordinal}. {step.title}
                    </div>
                    <div className="text-muted-foreground">{step.detail}</div>
                  </div>
                ))}
                {run.error ? <div className="text-destructive">{run.error}</div> : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
