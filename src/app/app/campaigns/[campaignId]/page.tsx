import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { platformLabel } from "@/lib/session-routing";
import { getCampaign } from "@/server/campaigns";
import { generateDraftsForCampaign } from "@/server/comment-pipeline";
import { pollListener } from "@/server/listeners";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${platformLabel(campaign.platform)} · ${campaign.mode}`}
        action={<Link href="/app/campaigns" className="text-sm text-primary">Back</Link>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <StatusPill label={campaign.status} color="var(--signal-ok)" />
              <StatusPill label={campaign.mode} color="var(--signal-info)" />
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