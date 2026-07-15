import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
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
          <Button variant="link" render={<Link href="/app/listeners" />} nativeButton={false}>
            Back
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
                <Label htmlFor="type">Type</Label>
                <FormSelect
                  id="type"
                  name="type"
                  defaultValue="keyword"
                  required
                  options={[
                    { value: "keyword", label: "Keyword" },
                    { value: "competitor", label: "Competitor" },
                    { value: "trend", label: "Trend" },
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaignId">Campaign (optional)</Label>
              <FormSelect
                id="campaignId"
                name="campaignId"
                defaultValue=""
                placeholder="None"
                options={[
                  { value: "", label: "None" },
                  ...campaigns.map((campaign) => ({
                    value: campaign.id,
                    label: campaign.name,
                  })),
                ]}
              />
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