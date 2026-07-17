import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminUpsertFlag, listAdminFlags } from "@/server/admin";

export default async function AdminFlagsPage() {
  const flags = await listAdminFlags();

  async function upsert(formData: FormData) {
    "use server";
    await adminUpsertFlag({
      key: String(formData.get("key") || ""),
      enabled: formData.get("enabled") === "on",
      description: String(formData.get("description") || ""),
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Feature flags</h1>
      <Card>
        <CardContent className="pt-6">
          <form action={upsert} className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="key">Key</Label>
              <Input id="key" name="key" placeholder="flag_key" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="description" />
            </div>
            <Label className="flex items-center gap-2 self-end text-sm font-normal">
              <Checkbox name="enabled" />
              enabled
            </Label>
            <div className="md:col-span-3">
              <Button type="submit">Save flag</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {flags.map((flag) => (
          <Card key={flag.id}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">
                {flag.key} · {flag.enabled ? "on" : "off"}
              </CardTitle>
              <CardDescription>{flag.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
