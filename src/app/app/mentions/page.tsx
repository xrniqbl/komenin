import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AssigneeBadge,
  AssigneeSelect,
  DraftList,
  RiskBadges,
  TemplateSelect,
} from "@/components/triage/triage-bits";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages } from "@/lib/i18n/messages";
import {
  approveMentionReply,
  assignMention,
  getAutoReplySettings,
  ignoreMention,
  listMentions,
  runMentionProcessNow,
  applyMentionTemplate,
  type MentionSort,
} from "@/server/mention-replies";
import { listAgents } from "@/server/agents";
import { listCommentTemplates } from "@/server/templates";
import { listWorkspaceAssignees } from "@/server/triage";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "secondary",
  generating: "secondary",
  drafted: "outline",
  approved: "outline",
  sent: "default",
  ignored: "secondary",
  failed: "destructive",
};

function normalizeSort(raw?: string): MentionSort {
  if (raw === "oldest" || raw === "newest" || raw === "risk") return raw;
  return "risk";
}

function mentionHref(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `/app/mentions?${str}` : "/app/mentions";
}

export default async function MentionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    assignee?: string;
    priority?: string;
    sort?: string;
    cursor?: string;
    run?: string;
    notice?: string;
  }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const t = messages[locale].triage;
  const sort = normalizeSort(params.sort);

  const [mentionList, settings, agents, members, templates] = await Promise.all([
    listMentions({
      status: params.status || undefined,
      assignee: params.assignee || undefined,
      priority: params.priority || undefined,
      sort,
      cursor: params.cursor || undefined,
    }),
    getAutoReplySettings(),
    listAgents(),
    listWorkspaceAssignees(),
    listCommentTemplates({ isActive: true }),
  ]);
  const mentions = mentionList.items;
  const baseParams = {
    status: params.status,
    assignee: params.assignee,
    priority: params.priority,
    sort: params.sort,
  };

  async function runProcess() {
    "use server";
    const result = await runMentionProcessNow();
    revalidatePath("/app/mentions");
    const qs = new URLSearchParams({ run: "1", notice: result.message });
    redirect(`/app/mentions?${qs.toString()}`);
  }

  async function saveSettings(formData: FormData) {
    "use server";
    const { updateAutoReplySettings } = await import("@/server/mention-replies");
    await updateAutoReplySettings({
      enabled: formData.get("enabled") === "on",
      agentId: (formData.get("agentId") as string) || null,
      mode: (formData.get("mode") as "auto" | "approval_required") || "approval_required",
      maxRepliesPerDay: Number(formData.get("maxRepliesPerDay") || 20),
      quietHoursApply: formData.get("quietHoursApply") === "on",
      templateText: (formData.get("templateText") as string) || null,
    });
    revalidatePath("/app/mentions");
    redirect("/app/mentions?notice=Auto-Reply+settings+saved");
  }

  async function approve(formData: FormData) {
    "use server";
    await approveMentionReply({
      mentionId: String(formData.get("mentionId")),
      draftId: (formData.get("draftId") as string) || undefined,
    });
    revalidatePath("/app/mentions");
  }

  async function ignore(formData: FormData) {
    "use server";
    await ignoreMention(String(formData.get("mentionId")));
    revalidatePath("/app/mentions");
  }

  async function assign(formData: FormData) {
    "use server";
    await assignMention({
      mentionId: String(formData.get("mentionId")),
      assigneeId: (formData.get("assigneeId") as string) || null,
    });
    revalidatePath("/app/mentions");
  }

  async function useTemplate(formData: FormData) {
    "use server";
    const templateId = String(formData.get("templateId") || "");
    if (!templateId) return;
    await applyMentionTemplate({
      mentionId: String(formData.get("mentionId")),
      templateId,
    });
    revalidatePath("/app/mentions");
  }

  return (
    <div>
      <PageHeader
        title="Mentions"
        description="Komentar/mention masuk di akun sendiri, terhubung ke pipeline auto-reply."
        action={
          <form action={runProcess}>
            <Button variant="electric" type="submit">Process now</Button>
          </form>
        }
      />

      {params.run === "1" && params.notice ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Pipeline result</CardTitle>
            <CardDescription>{params.notice}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Auto-Reply settings</CardTitle>
          <CardDescription>
            Balasan dikirim dari akun yang terhubung. Mode <code>approval_required</code> menahan
            semua balasan untuk review; mode <code>auto</code> langsung menjadwalkan balasan yang
            lolos risk-scan. Batas harian mencegah spam.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveSettings} className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <input
                id="enabled"
                name="enabled"
                type="checkbox"
                defaultChecked={settings?.enabled ?? false}
                className="size-4"
              />
              <Label htmlFor="enabled">Auto-reply aktif</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="quietHoursApply"
                name="quietHoursApply"
                type="checkbox"
                defaultChecked={settings?.quietHoursApply ?? true}
                className="size-4"
              />
              <Label htmlFor="quietHoursApply">Hormati quiet hours workspace</Label>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent">Agent</Label>
              <FormSelect
                id="agent"
                name="agentId"
                defaultValue={settings?.agentId || ""}
                options={[
                  { value: "", label: "Agent aktif pertama (default)" },
                  ...agents.map((agent) => ({
                    value: agent.id,
                    label: agent.name,
                  })),
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mode">Mode</Label>
              <FormSelect
                id="mode"
                name="mode"
                defaultValue={settings?.mode || "approval_required"}
                options={[
                  { value: "approval_required", label: "approval_required" },
                  { value: "auto", label: "auto (langsung jadwalkan)" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="maxRepliesPerDay">Maks balasan per hari</Label>
              <input
                id="maxRepliesPerDay"
                name="maxRepliesPerDay"
                type="number"
                min={1}
                max={500}
                defaultValue={settings?.maxRepliesPerDay ?? 20}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 backdrop-blur-xl"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="templateText">Template balasan (opsional, menimpa AI)</Label>
              <textarea
                id="templateText"
                name="templateText"
                rows={3}
                defaultValue={settings?.templateText || ""}
                placeholder="Hai {{authorHandle}}, thanks! Tim kami balas lebih detail via DM ya."
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 backdrop-blur-xl"
              />
              <p className="text-xs text-muted-foreground">
                Variabel: {"{{authorHandle}} {{platform}} {{postSnippet}} {{agentName}} {{topic}}"}. Kosongkan
                untuk balasan AI kontekstual; template tetap melewati risk-scan.
              </p>
            </div>
            <div className="flex items-end">
              <Button variant="electric" type="submit">Save settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {["all", "new", "drafted", "approved", "sent", "ignored", "failed"].map((status) => (
          <Link
            key={status}
            href={mentionHref({ ...baseParams, status: status === "all" ? undefined : status })}
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {status}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <form className="flex items-center gap-2">
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
          {params.priority ? <input type="hidden" name="priority" value={params.priority} /> : null}
          {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
          <Label htmlFor="assignee-filter">{t.assigneeLabel}</Label>
          <FormSelect
            id="assignee-filter"
            name="assignee"
            defaultValue={params.assignee || ""}
            options={[
              { value: "", label: t.assigneeAll },
              { value: "unassigned", label: t.assigneeUnassignedOnly },
              ...members.map((member) => ({
                value: member.id,
                label: member.name ? `${member.name} (${member.email})` : member.email,
              })),
            ]}
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" variant="glass">
            Filter
          </Button>
        </form>
        <span className="text-muted-foreground">{t.priorityLabel}:</span>
        <Link
          href={mentionHref({ ...baseParams, priority: undefined })}
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {t.priorityAll}
        </Link>
        <Link
          href={mentionHref({ ...baseParams, priority: "high" })}
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {t.priorityHigh}
        </Link>
        <span className="text-muted-foreground">{t.sortLabel}:</span>
        {(
          [
            ["risk", t.sortRisk],
            ["oldest", t.sortOldest],
            ["newest", t.sortNewest],
          ] as Array<[string, string]>
        ).map(([value, label]) => (
          <Link
            key={value}
            href={mentionHref({ ...baseParams, sort: value === "risk" ? undefined : value })}
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {label}
          </Link>
        ))}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t.filterHint}</p>

      <div className="space-y-3">
        {mentions.length === 0 ? (
          <Card className="gap-0 py-0">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>No mentions</EmptyTitle>
                <EmptyDescription>
                  Komentar masuk akan muncul di sini setelah webhook platform terdaftar atau
                  polling discovery aktif.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          mentions.map((mention) => (
            <Card key={mention.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardDescription>
                      @{mention.authorHandle} · {mention.platform}
                      {mention.socialAccount ? ` → @${mention.socialAccount.username}` : ""} ·{" "}
                      {new Date(mention.receivedAt).toISOString().slice(0, 16).replace("T", " ")}
                    </CardDescription>
                    <CardTitle className="text-base font-normal leading-relaxed">
                      {mention.content}
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AssigneeBadge assignee={mention.assignee} />
                      <RiskBadges triage={mention.triage} />
                      {mention.drafts.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t.draftsCount.replace("{count}", String(mention.drafts.length))}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[mention.status] || "secondary"}>
                    {mention.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <form action={assign} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="mentionId" value={mention.id} />
                  <AssigneeSelect
                    id={`assignee-${mention.id}`}
                    name="assigneeId"
                    defaultValue={mention.assigneeId || ""}
                    members={members}
                    unassignedLabel={t.unassigned}
                  />
                  <Button type="submit" size="sm" variant="glass">
                    {t.assignButton}
                  </Button>
                </form>

                <DraftList drafts={mention.drafts} emptyLabel={t.emptyDrafts} />

                {templates.length > 0 ? (
                  <form action={useTemplate} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="mentionId" value={mention.id} />
                    <span className="text-xs text-muted-foreground">{t.savedReplyLabel}</span>
                    <TemplateSelect
                      id={`template-${mention.id}`}
                      name="templateId"
                      templates={templates}
                      placeholder={t.savedReplyPlaceholder}
                    />
                    <Button type="submit" size="sm" variant="glass">
                      {t.useTemplateButton}
                    </Button>
                  </form>
                ) : (
                  <p className="text-xs text-muted-foreground">{t.noTemplates}</p>
                )}

                {mention.status === "drafted" && mention.drafts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {mention.drafts
                      .filter((draft) => draft.status === "pending")
                      .map((draft) => (
                        <form key={draft.id} action={approve}>
                          <input type="hidden" name="mentionId" value={mention.id} />
                          <input type="hidden" name="draftId" value={draft.id} />
                          <Button variant="electric" type="submit" size="sm">
                            {mention.drafts.length > 1 ? t.approveOneButton : t.approveButton}
                          </Button>
                        </form>
                      ))}
                    <form action={ignore}>
                      <input type="hidden" name="mentionId" value={mention.id} />
                      <Button type="submit" size="sm" variant="glass">
                        {t.ignoreButton}
                      </Button>
                    </form>
                  </div>
                ) : mention.action ? (
                  <div className="text-xs text-muted-foreground">
                    Reply {mention.action.status}
                    {mention.action.executedAt
                      ? ` · ${new Date(mention.action.executedAt).toISOString().slice(0, 16).replace("T", " ")}`
                      : ""}
                  </div>
                ) : mention.status === "new" ? (
                  <div className="text-xs text-muted-foreground">
                    Menunggu diproses worker (mention.process) — aktifkan Auto-Reply di atas agar
                    balasan digenerate.
                  </div>
                ) : mention.status === "ignored" ? (
                  <div className="text-xs text-muted-foreground">
                    Diabaikan (auto-reply nonaktif, limit harian tercapai, atau triage operator).
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {mentionList.hasMore && mentionList.nextCursor ? (
        <Button variant="glass" render={<Link href={mentionHref({ ...baseParams, cursor: mentionList.nextCursor })} />} nativeButton={false}>
          Tampilkan 100 mention berikutnya
        </Button>
      ) : null}
      {params.cursor ? (
        <Link className="ml-3 text-sm underline" href={mentionHref(baseParams)}>Kembali ke awal</Link>
      ) : null}
    </div>
  );
}
