import { PageHeader } from "@/components/app/page-header";
import { QuotaMeter } from "@/components/analytics/quota-meter";
import { RateLimitGrid } from "@/components/analytics/rate-limit-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listRateLimitStatus } from "@/server/rate-limits";

export default async function RateLimitsPage() {
  const data = await listRateLimitStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Limits"
        description={`Monthly period ${data.periodKey} · ${data.throttledCount} throttled account(s).`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span>Monthly Sends</span>
              <Badge variant={data.workspace.sendsStatus === "ok" ? "secondary" : "destructive"}>{data.workspace.sendsStatus}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <QuotaMeter used={data.workspace.sendsUsed} limit={data.workspace.sendLimit} label="Sends" />
            <div className="mt-2 text-xs text-muted-foreground">Plan: {data.workspace.planCode}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span>Monthly Publishes</span>
              <Badge variant={data.workspace.publishesStatus === "ok" ? "secondary" : "destructive"}>{data.workspace.publishesStatus}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <QuotaMeter used={data.workspace.publishesUsed} limit={data.workspace.publishLimit} label="Publishes" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">AI generations</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-semibold tabular-nums">{data.workspace.generatesUsed}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Comment/content drafts generated this period
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Skill runs</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-semibold tabular-nums">{data.workspace.skillRunsUsed}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Skill executions counted this period
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Batas aman per platform (anti-spam)</h3>
        <p className="mb-3 max-w-3xl text-xs text-muted-foreground">
          Estimasi konservatif agar akun tidak terdeteksi spam dan kena pembatasan. Sistem menegakkannya otomatis:
          campaign yang melebihi batas ditolak saat dibuat, pengiriman yang terlalu cepat dijadwalkan ulang,
          dan akun yang kena 429/action-blocked dijeda otomatis (status limited).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.guardrails.map((g) => (
            <Card key={g.platform}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{g.label}</div>
                  <Badge variant="outline" className="text-[10px]">{g.summary}</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Komentar {g.commentsPerHour}/jam · {g.commentsPerDay}/hari · jeda ≥{g.minIntervalMin} mnt · posting {g.publishesPerDay}/hari · akun baru {g.newAccountPerDay}/hari
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {g.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Account daily quotas</h3>
        <RateLimitGrid accounts={data.accounts} />
      </div>
    </div>
  );
}
