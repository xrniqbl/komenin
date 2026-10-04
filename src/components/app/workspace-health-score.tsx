"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type HealthCheckItem = {
  id: string;
  label: string;
  status: "good" | "warning" | "critical";
  detail: string;
  href?: string;
};

export type WorkspaceHealthScoreProps = {
  items: HealthCheckItem[];
};

export function WorkspaceHealthScore({ items }: WorkspaceHealthScoreProps) {
  const score = useMemo(() => {
    if (items.length === 0) return 0;
    const points = items.reduce((sum, item) => {
      if (item.status === "good") return sum + 100;
      if (item.status === "warning") return sum + 50;
      return sum;
    }, 0);
    return Math.round(points / items.length);
  }, [items]);

  const scoreColor =
    score >= 80
      ? "text-emerald-600"
      : score >= 50
        ? "text-amber-600"
        : "text-red-600";

  const scoreLabel =
    score >= 80
      ? "Excellent"
      : score >= 50
        ? "Needs attention"
        : "Action required";

  const ringColor =
    score >= 80
      ? "stroke-emerald-500"
      : score >= 50
        ? "stroke-amber-500"
        : "stroke-red-500";

  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Workspace Health</CardTitle>
        </div>
        <CardDescription>
          How ready your workspace is for live operations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          {/* Score ring */}
          <div className="relative flex size-28 shrink-0 items-center justify-center">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-neutral-100"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={`${ringColor} transition-all duration-1000 ease-out`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
                {score}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {scoreLabel}
              </span>
            </div>
          </div>

          {/* Health items */}
          <div className="flex-1 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  {item.status === "good" ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : item.status === "warning" ? (
                    <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  )}
                  <div>
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </div>
                </div>
                {item.href && item.status !== "good" && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    render={<Link href={item.href} />}
                    nativeButton={false}
                  >
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
