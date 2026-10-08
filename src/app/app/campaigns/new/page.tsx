import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages } from "@/lib/i18n/messages";
import {
  describePlatformLimits,
  getPlatformGuardrail,
  PLATFORM_GUARDRAILS,
  type PlatformName,
} from "@/lib/platform-rate-limits";
import { listAccounts } from "@/server/accounts";
import { createCampaign } from "@/server/campaigns";
import { listClients } from "@/server/clients";
import { getCommentTemplate, listCommentTemplates } from "@/server/templates";
import type { CampaignMode, Platform } from "@prisma/client";

const PLATFORM_KEYS = Object.keys(PLATFORM_GUARDRAILS) as PlatformName[];

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const t = messages[locale].campaigns;
  const [accounts, clients, templates] = await Promise.all([
    listAccounts(),
    listClients(),
    listCommentTemplates({ isActive: true }),
  ]);
  const activeClients = clients.filter((c) => c.isActive);
  const pickedTemplate = params.templateId ? await getCommentTemplate(params.templateId) : null;

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
      minDelaySec: Number(formData.get("minDelaySec") || 180),
      maxDelaySec: Number(formData.get("maxDelaySec") || 600),
      socialAccountIds,
      clientId: clientId || undefined,
    });
    redirect(`/app/campaigns/${campaign.id}`);
  }

  return (
    <div>
      <PageHeader
        title={t.newTitle}
        description={t.newDescription}
        action={
          <Button variant="link" render={<Link href="/app/campaigns" />} nativeButton={false}>
            {t.back}
          </Button>
        }
      />
      {templates.length > 0 ? (
        <Card className="mb-4 max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">{t.startFromTemplate}</CardTitle>
            <CardDescription>{t.startFromTemplateHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                <Label htmlFor="templateId">{t.templateLabel}</Label>
                <FormSelect
                  id="templateId"
                  name="templateId"
                  defaultValue={pickedTemplate?.id || ""}
                  options={[
                    { value: "", label: t.noTemplate },
                    ...templates.map((tpl) => ({
                      value: tpl.id,
                      label: `${tpl.name} · ${tpl.category}`,
                    })),
                  ]}
                />
              </div>
              <Button type="submit" variant="glass">
                {t.applyTemplate}
              </Button>
            </form>
            {pickedTemplate ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t.templateApplied}: <span className="font-medium">{pickedTemplate.name}</span>
                {" — "}
                <Link href="/app/campaigns/new" className="text-primary hover:underline">
                  {t.clearTemplate}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form action={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t.nameLabel}</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Product launch week"
                defaultValue={pickedTemplate ? pickedTemplate.name : undefined}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform">{t.platformLabel}</Label>
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
                <Label htmlFor="mode">{t.modeLabel}</Label>
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
              <Label htmlFor="goal">{t.goalLabel}</Label>
              <Input
                id="goal"
                name="goal"
                placeholder="Tingkatkan awareness produk"
                defaultValue={pickedTemplate ? pickedTemplate.body.slice(0, 280) : undefined}
              />
              {pickedTemplate ? (
                <p className="text-xs text-muted-foreground">
                  {t.prefilledFrom}: <span className="font-medium">{pickedTemplate.name}</span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="clientId">{t.clientLabel}</Label>
              <FormSelect
                id="clientId"
                name="clientId"
                defaultValue=""
                options={[
                  { value: "", label: t.unassigned },
                  ...activeClients.map((client) => ({
                    value: client.id,
                    label: client.name,
                  })),
                ]}
              />
              {activeClients.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.noClients}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="listenerQuery">{t.listenerLabel}</Label>
              <Input id="listenerQuery" name="listenerQuery" placeholder="diskon, tools otomasi" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dailyLimit">{t.dailyLimitLabel}</Label>
                <Input id="dailyLimit" name="dailyLimit" type="number" defaultValue={30} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="minDelaySec">{t.minDelayLabel}</Label>
                <Input id="minDelaySec" name="minDelaySec" type="number" defaultValue={180} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="maxDelaySec">{t.maxDelayLabel}</Label>
                <Input id="maxDelaySec" name="maxDelaySec" type="number" defaultValue={600} />
              </div>
            </div>
            <div className="rounded-lg border p-3 text-xs">
              <div className="font-medium">{t.effectivePacing}</div>
              <p className="mt-1 text-muted-foreground">{t.effectivePacingHint}</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {PLATFORM_KEYS.map((key) => (
                  <li key={key}>
                    <span className="font-medium text-foreground">
                      {getPlatformGuardrail(key).label}:
                    </span>{" "}
                    {describePlatformLimits(key)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-sm font-medium">{t.accountsLabel}</div>
              {accounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t.noAccounts}</div>
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
            <Button variant="electric" type="submit" size="lg">
              {t.launch}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}