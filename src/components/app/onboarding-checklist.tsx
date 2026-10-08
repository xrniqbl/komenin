"use client";

import { useState } from "react";
import Link from "next/link";
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import type { OnboardingChecklist } from "@/server/onboarding-checklist";

export function OnboardingChecklistCard({
  checklist,
}: {
  checklist: OnboardingChecklist;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!checklist.enabled || checklist.complete || isDismissed) return null;

  const progressPercent = (checklist.completedCount / checklist.total) * 100;
  const nextStep = checklist.steps.find((s) => !s.done);

  return (
    <Card className="group mb-6 overflow-hidden transition-shadow hover:shadow-md">
      {/* Animated gradient accent bar */}
      <div className="relative h-1 w-full overflow-hidden bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-electric-500 transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-electric-500 text-white shadow-[0_0_20px_rgba(46,124,246,0.4)]">
              <AutoAwesomeRoundedIcon className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">
                Get live in 15 minutes
              </CardTitle>
              <CardDescription className="mt-0.5">
                Finish these steps to run your first approval-safe campaign.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {checklist.completedCount}/{checklist.total}
            </Badge>
            <Button
              variant="glass"
              size="icon-xs"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? "Collapse checklist" : "Expand checklist"}
            >
              {isExpanded ? (
                <KeyboardArrowUpRoundedIcon className="size-4" />
              ) : (
                <KeyboardArrowDownRoundedIcon className="size-4" />
              )}
            </Button>
            <Button
              variant="glass"
              size="icon-xs"
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss checklist"
            >
              <CloseRoundedIcon className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <Progress value={progressPercent}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {progressPercent === 0
                  ? "Let's begin!"
                  : progressPercent < 60
                    ? "Making progress…"
                    : progressPercent < 100
                      ? "Almost there!"
                      : "Complete!"}
              </span>
              <span className="text-xs font-medium tabular-nums">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <ProgressTrack className="mt-1.5 h-2 bg-muted">
              <ProgressIndicator className="rounded-full bg-electric-500 transition-all duration-700 ease-out" />
            </ProgressTrack>
          </Progress>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-2 pt-0">
          {checklist.steps.map((step, index) => {
            const isNext = step.id === nextStep?.id;
            return (
              <div
                key={step.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-200 ${
                  step.done
                    ? "border-border bg-muted/50 opacity-60"
                    : isNext
                      ? "border-electric-500/30 bg-electric-500/10 shadow-sm"
                      : "border-border"
                }`}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                }}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs transition-all duration-300 ${
                      step.done
                        ? "bg-electric-500 text-white"
                        : isNext
                          ? "border-2 border-electric-500 text-electric-300"
                          : "border border-input text-muted-foreground"
                    }`}
                    style={
                      isNext
                        ? { animation: "pulse-ring 2s ease-out infinite" }
                        : undefined
                    }
                  >
                    {step.done ? (
                      <CheckRoundedIcon className="size-3" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-medium ${step.done ? "line-through" : ""}`}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {step.description}
                    </div>
                  </div>
                </div>
                {!step.done && (
                  <Button
                    size="sm"
                    variant={isNext ? "electric" : "glass"}
                    render={<Link href={step.href} />}
                    nativeButton={false}
                    className="shrink-0 gap-1"
                  >
                    {isNext ? "Start" : "Open"}
                    {isNext && <ArrowForwardRoundedIcon className="size-3" />}
                  </Button>
                )}
              </div>
            );
          })}

          {/* Animations */}
          <style>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulse-ring {
              0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 20%, transparent); }
              70%  { box-shadow: 0 0 0 6px transparent; }
              100% { box-shadow: 0 0 0 0 transparent; }
            }
          `}</style>
        </CardContent>
      )}
    </Card>
  );
}
