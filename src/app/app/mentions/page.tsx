import { revalidatePath } from "next/cache";
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
  approveMentionReply,
  getAutoReplySettings,
  ignoreMention,
  listMentions,
  runMentionProcessNow,
} from "@/server/mention-replies";
import { listAgents } from "@/server/agents";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "secondary",
  generating: "secondary",
  drafted: "outline",
  approved: "outline",
  sent: "default",
  ignored: "secondary",
  failed: "destructive",
};

export default async function MentionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; run?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const [mentionList, settings, agents] = await Promise.all([
    listMentions(params.status ? { status: params.status } : undefined),
    getAutoReplySettings(),
    listAgents(),
  ]);
  const mentions = mentionList.items;

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
    await approveMentionReply({ mentionId: String(formData.get("mentionId")) });
  }

  async function ignore(formData: FormData) {
    "use server";
    await ignoreMention(String(formData.get("mentionId")));
  }

  return (
    <div>
      <PageHeader
        title="Mentions"
        description="Komentar/mention masuk di akun sendiri, terhubung ke pipeline auto-reply."
        action={
          <form action={runProcess}>
            <Button type="submit">Process now</Button>
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
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
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
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Variabel: {"{{authorHandle}} {{platform}} {{postSnippet}} {{agentName}} {{topic}}"}. Kosongkan
                untuk balasan AI kontekstual; template tetap melewati risk-scan.
              </p>
            </div>
            <div className="flex items-end">
              <Button type="submit">Save settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {["all", "new", "drafted", "approved", "sent", "ignored", "failed"].map((status) => (
          <a
            key={status}
            href={status === "all" ? "/app/mentions" : `/app/mentions?status=${status}`}
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {status}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {mentions.length === 0 ? (          <Card className="gap-0 py-0">
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
                  </div>
                  <Badge variant={STATUS_VARIANT[mention.status] || "secondary"}>
                    {mention.status}
                  </Badge>
                </div>
              </CardHeader>
              {mention.draft ? (
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-muted/30 p-3 text-sm">
                    <div className="text-xs text-muted-foreground">
                      Draft · {mention.draft.status}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{mention.draft.content}</div>
                  </div>
                  {mention.status === "drafted" ? (
                    <div className="flex gap-2">
                      <form action={approve}>
                        <input type="hidden" name="mentionId" value={mention.id} />
                        <Button type="submit" size="sm">
                          Approve &amp; schedule reply
                        </Button>
                      </form>
                      <form action={ignore}>
                        <input type="hidden" name="mentionId" value={mention.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Ignore
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
                  ) : null}
                </CardContent>
              ) : (
                <CardContent>
                  {mention.status === "new" ? (
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
              )}
            </Card>
          ))
        )}
      </div>

      {mentionList.hasMore ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Menampilkan 100 mention terbaru — masih ada yang lebih lama. Gunakan filter status di
          atas untuk mempersempit daftar (mis. <a className="underline" href="/app/mentions?status=drafted">drafted</a>).
        </p>
      ) : null}
    </div>
  );
}
