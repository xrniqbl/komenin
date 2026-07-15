import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { listAccounts } from "@/server/accounts";
import { createCampaign } from "@/server/campaigns";
import type { CampaignMode, Platform } from "@prisma/client";

export default async function NewCampaignPage() {
  const accounts = await listAccounts();

  async function submit(formData: FormData) {
    "use server";
    const selected = formData.getAll("socialAccountIds").map(String);
    const campaign = await createCampaign({
      name: String(formData.get("name") || ""),
      platform: String(formData.get("platform") || "instagram") as Platform,
      mode: String(formData.get("mode") || "approval_required") as CampaignMode,
      goal: String(formData.get("goal") || ""),
      dailyLimit: Number(formData.get("dailyLimit") || 30),
      minDelaySec: Number(formData.get("minDelaySec") || 45),
      maxDelaySec: Number(formData.get("maxDelaySec") || 180),
      socialAccountIds: selected,
      listenerQuery: String(formData.get("listenerQuery") || ""),
    });
    redirect(`/app/campaigns/${campaign.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Create campaign"
        description="Default mode is approval_required for enterprise control."
        action={
          <Button variant="link" render={<Link href="/app/campaigns" />} nativeButton={false}>
            Back
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form action={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
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
                <Label htmlFor="mode">Mode</Label>
                <select id="mode" name="mode" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="approval_required">
                  <option value="approval_required">Approval required</option>
                  <option value="draft">Draft only</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal">Goal</Label>
              <Input id="goal" name="goal" placeholder="Tingkatkan awareness produk" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="listenerQuery">Listener keyword</Label>
              <Input id="listenerQuery" name="listenerQuery" placeholder="diskon, tools otomasi" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dailyLimit">Daily limit</Label>
                <Input id="dailyLimit" name="dailyLimit" type="number" defaultValue={30} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="minDelaySec">Min delay (sec)</Label>
                <Input id="minDelaySec" name="minDelaySec" type="number" defaultValue={45} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="maxDelaySec">Max delay (sec)</Label>
                <Input id="maxDelaySec" name="maxDelaySec" type="number" defaultValue={180} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-sm font-medium">Accounts</div>
              {accounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No accounts yet. You can still create campaign and attach later.
                </div>
              ) : (
                accounts.map((account) => (
                  <label key={account.id} className="flex items-center gap-2 text-sm">
                    <Checkbox name="socialAccountIds" value={account.id} />
                    <span>
                      @{account.username} ({account.platform})
                    </span>
                  </label>
                ))
              )}
            </div>
            <Button type="submit" size="lg">
              Launch campaign
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
