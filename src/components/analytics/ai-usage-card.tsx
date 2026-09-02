import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/billing/catalog";

type SourceBreakdown = {
  own_key: string;
  subscription: string;
  payg: string;
};

function fmtCredits(value: string): string {
  return new Intl.NumberFormat("id-ID").format(Number(value));
}

const SOURCE_LABEL: Record<keyof SourceBreakdown, string> = {
  own_key: "API key sendiri (BYOK)",
  subscription: "Kuota langganan",
  payg: "Pay-as-you-go",
};

export function AiUsageCard({
  data,
}: {
  data: {
    rangeDays: number;
    totalCalls: number;
    creditsBySource: SourceBreakdown;
    topModels: Array<{ model: string; calls: number; credits: string }>;
    estimatedCostIdr: number;
  };
}) {
  const sources = (Object.keys(SOURCE_LABEL) as Array<keyof SourceBreakdown>).map(
    (key) => ({ key, label: SOURCE_LABEL[key], credits: data.creditsBySource[key] }),
  );
  const totalCredits = sources.reduce((sum, s) => sum + Number(s.credits), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI usage · {data.rangeDays} hari</CardTitle>
        <CardDescription>
          {new Intl.NumberFormat("id-ID").format(data.totalCalls)} panggilan AI ·
          estimasi biaya Komenin-funded {formatIdr(data.estimatedCostIdr)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {sources.map((s) => {
            const pct = totalCredits > 0 ? Math.round((Number(s.credits) / totalCredits) * 100) : 0;
            return (
              <div key={s.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span>
                    {fmtCredits(s.credits)} kredit{s.key !== "own_key" ? ` · ${pct}%` : ""}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(pct, Number(s.credits) > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {data.topModels.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Model teratas</div>
            <div className="divide-y rounded-md border">
              {data.topModels.map((m) => (
                <div key={m.model} className="flex justify-between px-3 py-1.5 text-xs">
                  <span className="font-mono">{m.model}</span>
                  <span className="text-muted-foreground">
                    {m.calls}× · {fmtCredits(m.credits)} kredit
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Belum ada pemakaian AI pada rentang ini.</p>
        )}
      </CardContent>
    </Card>
  );
}
