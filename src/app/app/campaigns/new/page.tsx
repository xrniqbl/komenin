import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { listAccounts } from "@/server/accounts";
import { createCampaign } from "@/server/campaigns";
import { listClients } from "@/server/clients";
import type { CampaignMode, Platform } from "@prisma/client";

export default async function NewCampaignPage() {
  const [accounts, clients] = await Promise.all([listAccounts(), listClients()]);
  const activeClients = clients.filter((c) => c.isActive);

  async function submit(formData: FormData) {
    "use server";
    const socialAccountIds = formData.getAll("socialAccountIds").map(String);
    const clientId = String(formData.get("clientId") || "").trim();
    const campaign = await createCampaign({
      name: String(formData.get("name") || ""),
      platform: String(formData.get("platform") || "instagram") as Platform,
      mode: String(formData.get("mode") || "approval_required") as CampaignMode,
      goal: String(formData.get("goal") || "") || undefined,
      listenerQuery: String(formData.get("listenerQuery") || "") || undefined,
      dailyLimit: Number(formData.get("dailyLimit") || 30),
      minDelaySec: Number(formData.get("minDelaySec") || 45),
      maxDelaySec: Number(formData.get("maxDelaySec") || 180),
      socialAccountIds,
      clientId: clientId || undefined,
    });
    redirect(`/app/campaigns/${campaign.id}`);
  }

  return (
    <div>
      <PageHeader
        title="New campaign"
        description="Configure intent, mode, and attached social tunnels."
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
              <Input id="name" name="name" required placeholder="Product launch week" />
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
                    { value: "draft", label: "Draft only" },
                    { value: "auto", label: "Auto" },
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal">Goal</Label>
              <Input id="goal" name="goal" placeholder="Tingkatkan awareness produk" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="clientId">Client (optional)</Label>
              <FormSelect
                id="clientId"
                name="clientId"
                defaultValue=""
                options={[
                  { value: "", label: "Unassigned" },
                  ...activeClients.map((client) => ({
                    value: client.id,
                    label: client.name,
                  })),
                ]}
              />
              {activeClients.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No clients yet. Create one under Workspace → Clients.
                </p>
              ) : null}
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
                  <Label key={account.id} className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox name="socialAccountIds" value={account.id} />
                    <span>
                      @{account.username} ({account.platform})
                    </span>
                  </Label>
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