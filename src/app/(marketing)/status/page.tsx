import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicStatus } from "@/server/status";

export default async function StatusPage() {
  const checks = [
    {
      name: "Deployment region",
      ok: true,
      detail: process.env.KOMENIN_REGION || process.env.VERCEL_REGION || "ap-southeast-1",
    },
    { name: "Web app", ok: true, detail: "Next.js process" },
    { name: "Database", ok: Boolean(process.env.DATABASE_URL), detail: "DATABASE_URL" },
    {
      name: "Auth",
      ok: Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID),
      detail: "Auth.js Google",
    },
    { name: "Encryption", ok: Boolean(process.env.ENCRYPTION_KEY), detail: "ENCRYPTION_KEY" },
    { name: "Worker secret", ok: Boolean(process.env.WORKER_SECRET), detail: "WORKER_SECRET" },
    {
      name: "Live connector",
      ok:
        process.env.SIMULATOR_MODE === "false"
          ? Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_URL || process.env.SOCIAL_OFFICIAL_API_TOKEN)
          : true,
      // Never name the internal runtime mode on a public page — in prod this
      // branch shows the connector requirement; in dev it stays generic.
      detail:
        process.env.SIMULATOR_MODE === "false"
          ? "webhook or official token required"
          : "managed session worker",
    },
  ];

  let statusData: Awaited<ReturnType<typeof getPublicStatus>> | null = null;
  try {
    statusData = await getPublicStatus();
  } catch {
    // DB not available - show env checks only
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">System status</h1>
      <p className="mt-2 text-muted-foreground">
        Live operational signals from Komenin worker and delivery layer.
      </p>

      {statusData ? (
        <div className="mt-8 space-y-6">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Overall uptime (30d)</div>
                  <div className="text-xs text-muted-foreground">Based on worker job success rate</div>
                </div>
                <div className="text-3xl font-bold tracking-tight">{statusData.uptime.overall}%</div>
              </div>
              <div className="mt-4 flex h-12 items-end gap-0.5">
                {statusData.uptime.buckets.slice(-30).map((b) => (
                  <div
                    key={b.date}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      height: `${Math.max(8, b.uptime)}%`,
                      background: b.uptime >= 95 ? "#16a34a" : b.uptime >= 80 ? "#eab308" : "#dc2626",
                    }}
                    title={`${b.date}: ${b.uptime}%`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>{statusData.uptime.buckets[0]?.date || ""}</span>
                <span>
                  {statusData.uptime.buckets[statusData.uptime.buckets.length - 1]?.date || ""}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Worker success (24h)
                </div>
                <div className="mt-1 text-2xl font-semibold">{statusData.uptime.successRate24h}%</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {statusData.counts.succeeded24h} ok / {statusData.counts.jobs24h} total jobs
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Health probes (24h)
                </div>
                <div className="mt-1 text-2xl font-semibold">{statusData.uptime.healthRate}%</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {statusData.counts.healthChecks24h} checks
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm">Services</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {statusData.services.map((svc) => (
                <div
                  key={svc.name}
                  className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <div>
                    <div className="text-sm font-medium">{svc.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {svc.uptime != null ? (
                      <span className="text-xs text-muted-foreground">{svc.uptime}%</span>
                    ) : null}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        svc.status === "operational"
                          ? "bg-green-500/10 text-green-700"
                          : "bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      {svc.status}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm">Incident history (30d)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {statusData.incidents.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No incidents - all systems operational.
                </div>
              ) : (
                <div className="divide-y">
                  {statusData.incidents.map((inc, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{inc.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(inc.at).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{inc.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed bg-muted/30 shadow-none">
            <CardContent className="px-4 py-3 text-xs text-muted-foreground">
              JSON endpoint:{" "}
              <Link href="/api/status" className="font-medium underline">
                /api/status
              </Link>{" "}
              - public, no auth, safe for external monitors (UptimeRobot, BetterStack).
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Environment signals</h2>
        <div className="mt-4 space-y-3">
          {checks.map((check) => (
            <Card key={check.name}>
              <CardContent className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{check.name}</div>
                  <div className="text-xs text-muted-foreground">{check.detail}</div>
                </div>
                <div className={`text-xs font-medium ${check.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {check.ok ? "Operational" : "Attention"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}