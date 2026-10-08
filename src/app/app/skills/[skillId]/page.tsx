import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { EditSkillClient } from "@/components/skills/edit-skill-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSkill, listSkillRuns } from "@/server/skills";

const RUN_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  running: "secondary",
  succeeded: "default",
  failed: "destructive",
  cancelled: "outline",
};

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const { skillId } = await params;
  const skill = await getSkill(skillId);
  if (!skill) notFound();
  const runs = await listSkillRuns(20, { skillId });

  return (
    <div className="space-y-6">
      <PageHeader
        title={skill.name}
        description={`${skill.slug} · ${skill.executor} · v${skill.version} · ${skill._count.runs} runs`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="glass" render={<Link href="/app/skills" />} nativeButton={false}>
              Back
            </Button>
            <Badge variant="secondary">{skill.isActive ? "active" : "inactive"}</Badge>
            {skill.highRisk ? <Badge variant="destructive">high risk</Badge> : null}
          </div>
        }
      />

      <Card>
        <CardContent className="p-6">
          <EditSkillClient skill={skill} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Run history</CardTitle>
              <CardDescription>
                Latest {runs.length} run{runs.length === 1 ? "" : "s"} for this skill.
              </CardDescription>
            </div>
            <Button variant="glass" size="sm" render={<Link href={`/app/runs?skillId=${skill.id}`} />} nativeButton={false}>
              View all runs
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {runs.length === 0 ? (
            <div className="text-muted-foreground">No runs yet for this skill.</div>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={RUN_STATUS_VARIANT[run.status] || "secondary"}>
                    {run.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {run.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                    {run.agent ? ` · agent ${run.agent.name}` : ""}
                  </span>
                </div>
                {run.error ? (
                  <div className="mt-1 text-destructive">{run.error}</div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
