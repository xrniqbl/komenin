import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { listCampaigns } from "@/server/campaigns";
import { createListener } from "@/server/listeners";
import type { ListenerType, Platform } from "@prisma/client";

export default async function NewListenerPage() {
  const campaigns = await listCampaigns();

  async function submit(formData: FormData) {
    "use server";
    await createListener({
      platform: String(formData.get("platform") || "instagram") as Platform,
      type: String(formData.get("type") || "keyword") as ListenerType,
      query: String(formData.get("query") || ""),
      campaignId: String(formData.get("campaignId") || "") || undefined,
    });
    redirect("/app/listeners");
  }

  return (
    <div>
      <PageHeader
        title="Create listener"
        description="Watch keywords or competitor signals."
        action={
          <Button asChild variant="link">
            <Link href="/app/listeners">Back</Link>
          </Button>
        }
      />
      <Card className="max-w-xl">
        <CardContent className="pt-6">
          <form action={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="query">Query</Label>
              <Input id="query" name="query" required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform">Platform</Label>
                <select id="platform" name="platform" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="instagram">
                  <option value="instagram">Instagram</option>
                  <option value="threads">Threads</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">Type</Label>
                <select id="type" name="type" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="keyword">
                  <option value="keyword">Keyword</option>
                  <option value="competitor">Competitor</option>
                  <option value="trend">Trend</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaignId">Campaign (optional)</Label>
              <select id="campaignId" name="campaignId" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="">
                <option value="">None</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="lg">
              Save listener
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
