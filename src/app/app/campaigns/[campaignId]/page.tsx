import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { platformLabel } from "@/lib/session-routing";
import { getCampaign, setCampaignClient } from "@/server/campaigns";
import { listClients } from "@/server/clients";
import { generateDraftsForCampaign } from "@/server/comment-pipeline";
import { pollListener } from "@/server/listeners";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const [campaign, clients] = await Promise.all([getCampaign(campaignId), listClients()]);
  if (!campaign) notFound();

  async function assignClient(formData: FormData) {
    "use server";
    const clientId = String(formData.get("clientId") || "").trim();
    await setCampaignClient({
      campaignId,
      clientId: clientId || null,
    });
  }

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${platformLabel(campaign.platform)} · ${campaign.mode}${
          campaign.client ? ` · ${campaign.client.name}` : ""
        }`}
        action={<Link href="/app/campaigns" className="text-sm text-primary">Back</Link>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <StatusPill label={campaign.status} color="var(--signal-ok)" />
              <StatusPill label={campaign.mode} color="var(--signal-info)" />
              {campaign.client ? (
                <StatusPill label={campaign.client.name} color="var(--ink-500)" />
              ) : null}
            </div>
            <CardDescription>Goal: {campaign.goal || "—"}</CardDescription>
            <CardTitle className="text-base font-normal text-muted-foreground">
              Agent: {campaign.agent?.name || "Default"} · Delay {campaign.minDelaySec}-{campaign.maxDelaySec}s
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {campaign.listeners[0] ? (
              <form
                action={async () => {
                  "use server";
                  await pollListener(campaign.listeners[0].id);
                }}
              >
                <Button variant="outline" type="submit">
                  Poll listener
                </Button>
              </form>
            ) : null}
            <form
              action={async () => {
                "use server";
                await generateDraftsForCampaign(campaign.id);
              }}
            >
              <Button variant="default" type="submit">
                Generate drafts
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {campaign.accounts.length === 0 ? (
              <div className="text-muted-foreground">No accounts attached</div>
            ) : (
              campaign.accounts.map((item) => (
                <div key={item.id}>@{item.socialAccount.username}</div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Client assignment</CardTitle>
            <CardDescription>
              Tag this campaign for agency reporting. Leads captured from this campaign inherit the client when set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={assignClient} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                <Label htmlFor="clientId">Client</Label>
                <FormSelect
                  id="clientId"
                  name="clientId"
                  defaultValue={campaign.clientId || ""}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...clients.map((client) => ({
                      value: client.id,
                      label: `${client.name}${client.isActive ? "" : " (inactive)"}`,
                    })),
                  ]}
                />
              </div>
              <Button type="submit" variant="outline">
                Save client
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent target posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {campaign.targetPosts.map((post) => (
              <div key={post.id} className="rounded-lg border px-3 py-2">
                <div className="text-xs text-muted-foreground">@{post.authorHandle} · {post.status}</div>
                <div className="mt-1">{post.content}</div>
              </div>
            ))}
            {campaign.targetPosts.length === 0 ? <div className="text-muted-foreground">No posts yet.</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent drafts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {campaign.drafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border px-3 py-2">
                <div className="text-xs text-muted-foreground">{draft.status}</div>
                <div className="mt-1">{draft.content}</div>
              </div>
            ))}
            {campaign.drafts.length === 0 ? <div className="text-muted-foreground">No drafts yet.</div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}