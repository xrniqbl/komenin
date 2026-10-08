import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type FunnelStage = {
  key: string;
  label: string;
  value: number;
  conversionFromPrev: number | null;
};

function formatConversion(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

/**
 * Engagement funnel: listeners → posts → drafts → approvals → sends,
 * plus published auto-posts as a parallel outcome. Each stage shows the
 * conversion ratio vs the previous stage.
 */
export function FunnelCard({
  title,
  description,
  stages,
  footer,
  labels,
}: {
  title: string;
  description: string;
  stages: FunnelStage[];
  footer: string | null;
  labels: { conversion: string; noData: string };
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {stages.every((s) => s.value === 0) ? (
          <div className="text-muted-foreground">{labels.noData}</div>
        ) : (
          stages.map((stage, i) => (
            <div key={stage.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">
                    {i + 1}
                  </span>
                  {stage.label}
                </span>
                <span className="flex items-center gap-2">
                  {stage.conversionFromPrev != null ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {labels.conversion} {formatConversion(stage.conversionFromPrev)}
                    </span>
                  ) : null}
                  <span className="font-semibold tabular-nums">{stage.value}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${Math.max(4, Math.round((stage.value / max) * 100))}%` }}
                />
              </div>
            </div>
          ))
        )}
        {footer ? <div className="pt-1 text-xs text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
