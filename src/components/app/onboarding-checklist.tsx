import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnboardingChecklist } from "@/server/onboarding-checklist";

export function OnboardingChecklistCard({ checklist }: { checklist: OnboardingChecklist }) {
  if (!checklist.enabled || checklist.complete) return null;

  return (
    <Card className="mb-6 border-neutral-900/20 bg-background">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Get live in 15 minutes</CardTitle>
            <CardDescription>
              Finish these steps to run your first approval-safe campaign.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {checklist.completedCount}/{checklist.total} done
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {checklist.steps.map((step, index) => (
          <div
            key={step.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={
                  step.done
                    ? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs text-white"
                    : "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs text-muted-foreground"
                }
              >
                {step.done ? "✓" : index + 1}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{step.title}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            </div>
            {!step.done ? (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={step.href} />}
                nativeButton={false}
              >
                Open
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
