import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/app/page-header";
import { CreateSkillForm } from "@/components/skills/create-skill-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { executeSkillNow, listSkills } from "@/server/skills";

export default async function SkillsPage() {
  const skills = await listSkills();

  async function runAction(formData: FormData) {
    "use server";
    await executeSkillNow({
      skillId: String(formData.get("skillId") || ""),
      inputText: String(formData.get("inputText") || ""),
    });
    revalidatePath("/app/skills");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="Builtin and webhook tools with trigger matching and CoT runs."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register skill</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateSkillForm />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {skills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <Link href={`/app/skills/${skill.id}`} className="hover:underline">
                    {skill.name}
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">v{skill.version}</Badge>
                  <Button
                    size="sm"
                    variant="glass"
                    render={<Link href={`/app/skills/${skill.id}`} />}
                    nativeButton={false}
                  >
                    Edit
                  </Button>
                </div>
              </div>
              <CardDescription>
                {skill.slug} · {skill.executor} · runs {skill._count.runs}
                {skill.highRisk ? " · high risk" : ""}
                {skill.isActive ? "" : " · inactive"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-muted-foreground">{skill.description}</div>
              <div className="text-xs">
                Triggers: {skill.triggers.map((t) => t.pattern).join(", ") || "—"}
              </div>
              <div className="text-xs">
                <Link
                  href={`/app/runs?skillId=${skill.id}`}
                  className="text-primary hover:underline"
                >
                  View run history ({skill._count.runs})
                </Link>
              </div>
              <form action={runAction} className="flex flex-col gap-2 md:flex-row">
                <input type="hidden" name="skillId" value={skill.id} />
                <Input
                  name="inputText"
                  placeholder="Test input text"
                  className="flex-1"
                  defaultValue={skill.triggers[0]?.pattern || ""}
                />
                <Button type="submit" variant="glass">
                  Run
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
