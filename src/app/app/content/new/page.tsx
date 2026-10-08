import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listAccounts } from "@/server/accounts";
import { createContentCampaign, generateContentCampaignDrafts } from "@/server/content-campaigns";
import type { CampaignMode, ContentIntervalUnit, Platform } from "@prisma/client";

export default async function NewContentCampaignPage() {
  const accounts = await listAccounts();

  async function submit(formData: FormData) {
    "use server";
    const campaign = await createContentCampaign({
      name: String(formData.get("name") || ""),
      topic: String(formData.get("topic") || ""),
      platform: String(formData.get("platform") || "instagram") as Platform,
      mode: String(formData.get("mode") || "approval_required") as CampaignMode,
      postCount: Number(formData.get("postCount") || 5),
      intervalValue: Number(formData.get("intervalValue") || 6),
      intervalUnit: String(formData.get("intervalUnit") || "hours") as ContentIntervalUnit,
      socialAccountId: String(formData.get("socialAccountId") || "") || undefined,
      notes: String(formData.get("notes") || "") || undefined,
    });

    // Generate immediately so user lands on drafts.
    await generateContentCampaignDrafts(campaign.id);
    redirect(`/app/content/${campaign.id}`);
  }

  return (
    <div>
      <PageHeader
        title="New auto post campaign"
        description="Describe a topic. Komenin generates N posts and schedules them by interval."
        action={
          <Button variant="link" render={<Link href="/app/content" />} nativeButton={false}>
            Back
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form action={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Campaign name</Label>
              <Input id="name" name="name" required placeholder="AI for UMKM series" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="topic">Topic to discuss</Label>
              <Textarea
                id="topic"
                name="topic"
                required
                className="min-h-28"
                placeholder="Manfaat AI untuk operasional UMKM, tips mulai dari yang murah, studi kasus sederhana..."
              />
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
                <Label htmlFor="mode">Mode</Label>
                <FormSelect
                  id="mode"
                  name="mode"
                  defaultValue="approval_required"
                  required
                  options={[
                    { value: "approval_required", label: "Approval required" },
                    { value: "auto", label: "Auto publish" },
                    { value: "draft", label: "Draft only" },
                  ]}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="postCount">How many posts</Label>
                <Input id="postCount" name="postCount" type="number" min={1} max={50} defaultValue={5} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="intervalValue">Every</Label>
                <Input id="intervalValue" name="intervalValue" type="number" min={1} defaultValue={6} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="intervalUnit">Unit</Label>
                <FormSelect
                  id="intervalUnit"
                  name="intervalUnit"
                  defaultValue="hours"
                  required
                  options={[
                    { value: "minutes", label: "Minutes" },
                    { value: "hours", label: "Hours" },
                    { value: "days", label: "Days" },
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="socialAccountId">Publish account (optional)</Label>
              <FormSelect
                id="socialAccountId"
                name="socialAccountId"
                defaultValue=""
                placeholder="Choose later"
                options={[
                  { value: "", label: "Choose later" },
                  ...accounts.map((account) => ({
                    value: account.id,
                    label: `@${account.username} (${account.platform})`,
                  })),
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" className="min-h-20" placeholder="CTA, banned claims, brand voice..." />
            </div>
            <Button variant="electric" type="submit" size="lg">
              Generate posts
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}