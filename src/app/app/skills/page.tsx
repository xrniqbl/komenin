import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSkill, executeSkillNow, listSkills } from "@/server/skills";

export default async function SkillsPage() {
  const skills = await listSkills();

  async function createAction(formData: FormData) {
    "use server";
    await createSkill({
      name: String(formData.get("name") || ""),
      slug: String(formData.get("slug") || ""),
      description: String(formData.get("description") || ""),
      highRisk: formData.get("highRisk") === "on",
      triggers: String(formData.get("triggers") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      configJson: { note: "custom skill" },
    });
  }

  async function runAction(formData: FormData) {
    "use server";
    await executeSkillNow({
      skillId: String(formData.get("skillId") || ""),
      inputText: String(formData.get("inputText") || ""),
    });
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
          <form action={createAction} className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" placeholder="slug-name" required />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Description" />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="triggers">Triggers</Label>
              <Input id="triggers" name="triggers" placeholder="triggers,comma,separated" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="highRisk" />
              High risk (force approval)
            </label>
            <div>
              <Button type="submit">Create skill</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {skills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader>
              <CardTitle className="text-base">{skill.name}</CardTitle>
              <CardDescription>
                {skill.slug} · {skill.executor} · runs {skill._count.runs}
                {skill.highRisk ? " · high risk" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-muted-foreground">{skill.description}</div>
              <div className="text-xs">
                Triggers: {skill.triggers.map((t) => t.pattern).join(", ") || "—"}
              </div>
              <form action={runAction} className="flex flex-col gap-2 md:flex-row">
                <input type="hidden" name="skillId" value={skill.id} />
                <Input
                  name="inputText"
                  placeholder="Test input text"
                  className="flex-1"
                  defaultValue="Ada promo atau coupon bulan ini?"
                />
                <Button type="submit" variant="outline">
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
