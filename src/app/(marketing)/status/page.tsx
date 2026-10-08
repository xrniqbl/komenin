import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages } from "@/lib/i18n/messages";
import { getPublicStatus } from "@/server/status";

export default async function StatusPage() {
  const locale = await getRequestLocale();
  const copy = messages[locale].statusPage;
  // Public capability signals only — never expose internal env var names or
  // raw configuration values on a public page.
  const checks = [
    {
      name: copy.envChecks.region,
      ok: true,
      detail: process.env.KOMENIN_REGION || process.env.VERCEL_REGION || "ap-southeast-1",
    },
    { name: copy.envChecks.webApp, ok: true, detail: "Next.js process" },
    { name: copy.envChecks.database, ok: Boolean(process.env.DATABASE_URL), detail: copy.envChecks.database },
    {
      name: copy.envChecks.auth,
      ok: Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID),
      detail: copy.envChecks.auth,
    },
    { name: copy.envChecks.encryption, ok: Boolean(process.env.ENCRYPTION_KEY), detail: copy.envChecks.encryption },
    { name: copy.envChecks.workerSecret, ok: Boolean(process.env.WORKER_SECRET), detail: copy.envChecks.workerSecret },
    {
      name: copy.envChecks.liveConnector,
      ok:
        process.env.SIMULATOR_MODE === "false"
          ? Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_URL || process.env.SOCIAL_OFFICIAL_API_TOKEN)
          : true,
      // Never name the internal runtime mode on a public page — in prod this
      // branch shows the connector requirement; in dev it stays generic.
      detail:
        process.env.SIMULATOR_MODE === "false"
          ? copy.liveConnectorLive
          : copy.liveConnectorSim,
    },
  ];

  let statusData: Awaited<ReturnType<typeof getPublicStatus>> | null = null;
  let statusError = false;
  try {
    statusData = await getPublicStatus(locale);
  } catch {
    // DB not available - show env checks only plus an explicit notice below.
    statusError = true;
  }

  return (
    <div className="bg-transparent">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white">{copy.title}</h1>
      <p className="mt-2 text-neutral-400">
        {copy.subtitle}
      </p>

      {statusError && !statusData ? (
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {copy.statusUnavailable}
        </div>
      ) : null}

      {statusData ? (
        <div className="mt-8 space-y-6">
          <Card className="glass border-white/10 bg-white/5 shadow-none backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{copy.uptimeTitle}</div>
                  <div className="text-xs text-neutral-400">{copy.uptimeSubtitle}</div>
                </div>
                <div className="text-3xl font-bold tracking-tight text-white">{statusData.uptime.overall}%</div>
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
                    role="img"
                    aria-label={`${b.date}: ${b.uptime}% uptime`}
                    title={`${b.date}: ${b.uptime}%`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-neutral-500">
                <span>{statusData.uptime.buckets[0]?.date || ""}</span>
                <span>
                  {statusData.uptime.buckets[statusData.uptime.buckets.length - 1]?.date || ""}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="glass border-white/10 bg-white/5 shadow-none backdrop-blur-xl">
              <CardContent className="px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500">
                  {copy.workerSuccess}
                </div>
                <div className="mt-1 text-2xl font-semibold text-white">{statusData.uptime.successRate24h}%</div>
                <div className="mt-1 text-xs text-neutral-400">
                  {statusData.counts.succeeded24h} {copy.jobsOk} / {statusData.counts.jobs24h} {copy.jobsTotal}
                </div>
              </CardContent>
            </Card>
            <Card className="glass border-white/10 bg-white/5 shadow-none backdrop-blur-xl">
              <CardContent className="px-4 py-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500">
                  {copy.healthProbes}
                </div>
                <div className="mt-1 text-2xl font-semibold text-white">{statusData.uptime.healthRate}%</div>
                <div className="mt-1 text-xs text-neutral-400">
                  {statusData.counts.healthChecks24h} {copy.checks}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 border-white/10 bg-white/5 py-0 shadow-none backdrop-blur-xl">
            <CardHeader className="border-white/10 px-4 py-3">
              <CardTitle className="text-sm text-white">{copy.services}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {statusData.services.map((svc) => (
                <div
                  key={svc.name}
                  className="flex flex-wrap items-center justify-between gap-3 border-white/10 px-4 py-3 last:border-b-0"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{svc.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {svc.uptime != null ? (
                      <span className="text-xs text-neutral-400">{svc.uptime}%</span>
                    ) : null}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        svc.status === "operational"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {svc.status === "operational" ? copy.operational : copy.degraded}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-0 border-white/10 bg-white/5 py-0 shadow-none backdrop-blur-xl">
            <CardHeader className="border-white/10 px-4 py-3">
              <CardTitle className="text-sm text-white">{copy.incidents}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {statusData.incidents.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-neutral-400">
                  {copy.noIncidents}
                </div>
              ) : (
                <div className="divide-y">
                  {statusData.incidents.map((inc, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">{inc.title}</span>
                        <span className="text-xs text-neutral-400">
                          {new Date(inc.at).toLocaleString(locale === "id" ? "id-ID" : "en-US")}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">{inc.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass border-dashed rounded-2xl">
            <CardContent className="px-4 py-3 text-xs text-neutral-400">
              {copy.jsonEndpoint}{" "}
              <Link href="/api/status" className="font-medium text-electric-400 underline">
                /api/status
              </Link>{" "}
              {copy.jsonSuffix}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-white">{copy.envSignals}</h2>
        <div className="mt-4 space-y-3">
          {checks.map((check) => (
            <Card key={check.name}>
              <CardContent className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">{check.name}</div>
                  <div className="text-xs text-neutral-400">{check.detail}</div>
                </div>
                <div className={`text-xs font-medium ${check.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {check.ok ? copy.operational : copy.attention}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
