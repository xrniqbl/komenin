import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { createAccount } from "@/server/accounts";
import { listProxies } from "@/server/proxies";
import type { Platform } from "@prisma/client";

export default async function NewAccountPage() {
  const proxies = await listProxies();

  async function submit(formData: FormData) {
    "use server";
    const account = await createAccount({
      platform: String(formData.get("platform") || "instagram") as Platform,
      username: String(formData.get("username") || ""),
      displayName: String(formData.get("displayName") || "") || undefined,
      proxyEndpointId: String(formData.get("proxyId") || "") || undefined,
      sessionPayload: String(formData.get("sessionPayload") || ""),
    });
    redirect(`/app/accounts/${account.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Connect account"
        description="Register a social identity and bind an optional proxy tunnel."
        action={
          <Button variant="link" render={<Link href="/app/accounts" />} nativeButton={false}>
            Back to accounts
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form action={submit} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform">Platform</Label>
                <FormSelect
                  id="platform"
                  name="platform"
                  defaultValue="instagram"
                  required
                  options={[
                    { value: "instagram", label: "Instagram" },
                    { value: "threads", label: "Threads" },
                    { value: "tiktok", label: "TikTok" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" required placeholder="brand.official" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="proxyId">Proxy (optional)</Label>
              <FormSelect
                id="proxyId"
                name="proxyId"
                defaultValue=""
                placeholder="Auto-assign later"
                options={[
                  { value: "", label: "Auto-assign later" },
                  ...proxies.map((proxy) => ({
                    value: proxy.id,
                    label: `${proxy.label} (${proxy.host}:${proxy.port})`,
                  })),
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sessionPayload">Session payload (JSON)</Label>
              <Textarea
                id="sessionPayload"
                name="sessionPayload"
                required
                className="min-h-28"
                placeholder='{"cookies":[],"ua":"..."}'
              />
            </div>
            <Button type="submit" size="lg">
              Save account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}