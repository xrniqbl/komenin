import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FEATURE_FLAG_KEYS, ensureDefaultFeatureFlags } from "@/lib/feature-flags";
import { adminUpsertFlag, listAdminFlags } from "@/server/admin";

export default async function AdminFlagsPage() {
  await ensureDefaultFeatureFlags();
  const flags = await listAdminFlags();

  async function upsert(formData: FormData) {
    "use server";
    await adminUpsertFlag({
      key: String(formData.get("key") || ""),
      enabled: formData.get("enabled") === "on",
      description: String(formData.get("description") || ""),
    });
  }

  const knownKeys = Object.values(FEATURE_FLAG_KEYS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Feature flags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Runtime flags gate product surfaces via <code>isFeatureEnabled()</code>. Unknown keys
          default open; experimental keys default off.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Known keys</CardTitle>
          <CardDescription>
            {knownKeys.map((k) => (
              <code key={k} className="mr-2 text-xs">
                {k}
              </code>
            ))}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form action={upsert} className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="key">Key</Label>
              <Input id="key" name="key" placeholder="flag_key" required list="known-flags" />
              <datalist id="known-flags">
                {knownKeys.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
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
            <CardContent className="p-4 pt-0">
              <form action={upsert} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="key" value={flag.key} />
                <input type="hidden" name="description" value={flag.description || ""} />
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox name="enabled" defaultChecked={flag.enabled} />
                  enabled
                </Label>
                <Button type="submit" size="sm" variant="outline">
                  Update
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
