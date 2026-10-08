import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { platformLabel } from "@/lib/session-routing";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages } from "@/lib/i18n/messages";
import { describePlatformLimits } from "@/lib/platform-rate-limits";
import { hourInTimezone, isInQuietHours } from "@/lib/workspace-time";
import { CampaignRowActions } from "@/components/campaigns/campaign-row-actions";
import {
  getCampaign,
  getCampaignEffectivePacing,
  getCampaignVariantStats,
  saveCampaignAsTemplate,
  setCampaignClient,
  setDraftVariant,
} from "@/server/campaigns";
import { listClients } from "@/server/clients";
import { generateDraftsForCampaign } from "@/server/comment-pipeline";
import { pollListener } from "@/server/listeners";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const locale = await getRequestLocale();
  const t = messages[locale].campaigns;
  const [campaign, clients, pacing, variantStats] = await Promise.all([
    getCampaign(campaignId),
    listClients(),
    getCampaignEffectivePacing(campaignId),
    getCampaignVariantStats(campaignId),
  ]);
  if (!campaign) notFound();

  const quiet = campaign.workspaceSettings
    ? {
        ...campaign.workspaceSettings,
        active: isInQuietHours({
          date: new Date(),
          timeZone: campaign.workspaceSettings.timezone,
          startHour: campaign.workspaceSettings.quietHoursStart,
          endHour: campaign.workspaceSettings.quietHoursEnd,
        }),
        nowHour: hourInTimezone(new Date(), campaign.workspaceSettings.timezone),
      }
    : null;

  async function assignClient(formData: FormData) {
    "use server";
    const clientId = String(formData.get("clientId") || "").trim();
    await setCampaignClient({
      campaignId,
      clientId: clientId || null,
    });
  }

  async function assignVariant(formData: FormData) {
    "use server";
    await setDraftVariant({
      draftId: String(formData.get("draftId") || ""),
      variant: String(formData.get("variant") || ""),
    });
  }

  async function saveAsTemplate(formData: FormData) {
    "use server";
    await saveCampaignAsTemplate({
      campaignId,
      name: String(formData.get("templateName") || "") || undefined,
    });
  }

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${platformLabel(campaign.platform)} · ${campaign.mode}${
          campaign.client ? ` · ${campaign.client.name}` : ""
        }`}
        action={
          <div className="flex items-center gap-2">
            <CampaignRowActions campaignId={campaign.id} status={campaign.status} />
            <Link href="/app/campaigns" className="text-sm text-primary">{t.back}</Link>
          </div>
        }
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
              {quiet && quiet.quietHoursStart !== quiet.quietHoursEnd ? (
                <StatusPill
                  label={
                    quiet.active
                      ? `${t.quietActive} (${String(quiet.quietHoursStart).padStart(2, "0")}:00–${String(quiet.quietHoursEnd).padStart(2, "0")}:00)`
                      : t.quietScheduled
                  }
                  color={quiet.active ? "var(--signal-warn)" : "var(--ink-500)"}
                />
              ) : null}
            </div>
            <CardDescription>
              {t.goalPrefix}: {campaign.goal || "—"}
            </CardDescription>
            <CardTitle className="text-base font-normal text-muted-foreground">
              {t.agentPrefix}: {campaign.agent?.name || "Default"} · {t.delayPrefix}{" "}
              {campaign.minDelaySec}-{campaign.maxDelaySec}s
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
                <Button variant="glass" type="submit">
                  {t.pollListener}
                </Button>
              </form>
            ) : null}
            <form
              action={async () => {
                "use server";
                await generateDraftsForCampaign(campaign.id);
              }}
            >
              <Button variant="electric" type="submit">
                {t.generateDrafts}
              </Button>
            </form>
            <form action={saveAsTemplate} className="flex items-center gap-2">
              <Input
                name="templateName"
                placeholder={t.templateNamePlaceholder}
                className="h-9 w-44"
                maxLength={120}
              />
              <Button variant="glass" type="submit">
                {t.saveAsTemplate}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.accounts}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {campaign.accounts.length === 0 ? (
              <div className="text-muted-foreground">{t.noAccountsAttached}</div>
            ) : (
              campaign.accounts.map((item) => (
                <div key={item.id}>@{item.socialAccount.username}</div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.effectivePacing}</CardTitle>
            <CardDescription>{t.effectivePacingDetail}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {pacing ? (
              <>
                <div>
                  {t.platformLimit}: {pacing.platformPerHour}
                  {t.perHour} · {pacing.platformPerDay}
                  {t.perDay} · {t.minDelay} {pacing.minDelaySec}s
                </div>
                <div>
                  {t.campaignLimit}: {pacing.campaignDailyLimit}
                  {t.perDay} → {t.effective}: {pacing.effectiveDailyLimit}
                  {t.perDay}
                </div>
                <div>
                  {t.sentLastHour}: {pacing.sentLastHour} · {t.hourlyRemaining}:{" "}
                  {pacing.hourlyRemaining}
                  {pacing.hourlyBlocked ? ` · ${t.hourlyBlocked}` : ""}
                </div>
                <div>
                  {t.sentToday}: {pacing.sentToday} · {t.dailyRemaining}: {pacing.dailyRemaining}
                </div>
                <div className="pt-1">{describePlatformLimits(campaign.platform)}</div>
              </>
            ) : (
              <div>{t.pacingUnavailable}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.quietHours}</CardTitle>
            <CardDescription>{t.quietHoursDetail}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {quiet ? (
              <>
                <div>
                  {t.window}: {String(quiet.quietHoursStart).padStart(2, "0")}:00–
                  {String(quiet.quietHoursEnd).padStart(2, "0")}:00 ({quiet.timezone})
                </div>
                <div>
                  {t.localHourNow}: {String(quiet.nowHour).padStart(2, "0")}:00 ·{" "}
                  {quiet.active ? t.quietActive : t.quietInactive}
                </div>
                <Link href="/app/settings/general" className="inline-block pt-1 text-primary hover:underline">
                  {t.manageQuiet}
                </Link>
              </>
            ) : (
              <div>{t.pacingUnavailable}</div>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t.variantTitle}</CardTitle>
            <CardDescription>{t.variantHint}</CardDescription>
          </CardHeader>
          <CardContent>
            {variantStats && variantStats.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.variantCol}</TableHead>
                    <TableHead>{t.draftsCol}</TableHead>
                    <TableHead>{t.approvedCol}</TableHead>
                    <TableHead>{t.sentCol}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variantStats.map((row) => (
                    <TableRow key={row.variant}>
                      <TableCell className="font-medium">{row.variant}</TableCell>
                      <TableCell>{row.drafts}</TableCell>
                      <TableCell>{row.approved}</TableCell>
                      <TableCell>{row.sent}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground">{t.noVariants}</div>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t.clientTitle}</CardTitle>
            <CardDescription>{t.clientHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={assignClient} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                <Label htmlFor="clientId">{t.clientLabel}</Label>
                <FormSelect
                  id="clientId"
                  name="clientId"
                  defaultValue={campaign.clientId || ""}
                  options={[
                    { value: "", label: t.unassigned },
                    ...clients.map((client) => ({
                      value: client.id,
                      label: `${client.name}${client.isActive ? "" : " (inactive)"}`,
                    })),
                  ]}
                />
              </div>
              <Button type="submit" variant="glass">
                {t.saveClient}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.recentPosts}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {campaign.targetPosts.map((post) => (
              <div key={post.id} className="rounded-lg border px-3 py-2">
                <div className="text-xs text-muted-foreground">@{post.authorHandle} · {post.status}</div>
                <div className="mt-1">{post.content}</div>
              </div>
            ))}
            {campaign.targetPosts.length === 0 ? <div className="text-muted-foreground">{t.noPosts}</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.recentDrafts}</CardTitle>
            <CardDescription>{t.recentDraftsHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {campaign.drafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{draft.status}</span>
                  <span className="font-medium text-foreground">
                    {t.variantCol} {draft.variant || "—"}
                  </span>
                  {draft.action ? <span>· {draft.action.status}</span> : null}
                </div>
                <div className="mt-1">{draft.content}</div>
                <form action={assignVariant} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="draftId" value={draft.id} />
                  <Input
                    name="variant"
                    defaultValue={draft.variant || ""}
                    placeholder={t.variantPlaceholder}
                    maxLength={12}
                    className="h-8 w-24"
                  />
                  <Button type="submit" variant="glass" size="sm">
                    {t.setVariant}
                  </Button>
                </form>
              </div>
            ))}
            {campaign.drafts.length === 0 ? <div className="text-muted-foreground">{t.noDrafts}</div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}