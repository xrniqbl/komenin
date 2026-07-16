import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listSkillRuns } from "@/server/skills";

export default async function RunsPage() {
  const runs = await listSkillRuns(100);

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Skill execution timeline with chain-of-thought steps."
        action={<Link href="/app/skills" className="text-sm text-primary hover:underline">Manage skills</Link>}
      />
      <div className="space-y-3">
        {runs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No runs yet</CardTitle>
              <CardDescription>Execute a skill from /app/skills or let comment generation trigger one.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          runs.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {run.skill.name} · {run.status}
                </CardTitle>
                <CardDescription>
                  {run.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                  {run.agent ? ` · agent ${run.agent.name}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {run.steps.map((step) => (
                  <div key={step.id} className="rounded-lg border p-3">
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
