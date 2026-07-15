import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/page-header";
import { createAccount } from "@/server/accounts";
import { listProxies } from "@/server/proxies";
import type { Platform } from "@prisma/client";

export default async function NewAccountPage() {
  const proxies = await listProxies();

  async function submit(formData: FormData) {
    "use server";
    const platform = String(formData.get("platform") || "instagram") as Platform;
    const username = String(formData.get("username") || "");
    const displayName = String(formData.get("displayName") || "");
    const sessionPayload = String(formData.get("sessionPayload") || "");
    const userAgent = String(formData.get("userAgent") || "");
    const proxyEndpointId = String(formData.get("proxyEndpointId") || "");
    const notes = String(formData.get("notes") || "");

    const account = await createAccount({
      platform,
      username,
      displayName: displayName || undefined,
      sessionPayload,
      userAgent: userAgent || undefined,
      proxyEndpointId: proxyEndpointId || undefined,
      notes: notes || undefined,
    });

    redirect(`/app/accounts/${account.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Connect account"
        description="Import a session bundle and bind it to a proxy tunnel."
        action={
          <Button asChild variant="link">
            <Link href="/app/accounts">Back to accounts</Link>
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form action={submit} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform">Platform</Label>
                <select
                  id="platform"
                  name="platform"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue="instagram"
                >
                  <option value="instagram">Instagram</option>
                  <option value="threads">Threads</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" required placeholder="brand.ops" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" placeholder="Brand Ops" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sessionPayload">Session payload (cookies/token JSON)</Label>
              <Textarea
                id="sessionPayload"
                name="sessionPayload"
                required
                placeholder='{"sessionid":"..."}'
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="userAgent">User agent (optional)</Label>
              <Input id="userAgent" name="userAgent" placeholder="Mozilla/5.0 ..." />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="proxyEndpointId">Proxy tunnel</Label>
              <select
                id="proxyEndpointId"
                name="proxyEndpointId"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue=""
              >
                <option value="">No proxy yet</option>
                {proxies.map((proxy) => (
                  <option key={proxy.id} value={proxy.id}>
                    {proxy.label} ({proxy.host}:{proxy.port})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" />
            </div>
            <Button type="submit" size="lg">
              Save account tunnel
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
