"use client";

import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import { Badge } from "@/components/ui/badge";
import { Reveal } from "./reveal";
import { CommentEngineMock } from "./feature-demo-mocks";

const POINTS = [
  {
    title: "Reply in under a minute",
    body: "AI drafts the moment a comment lands — you just approve.",
  },
  {
    title: "Never miss a mention",
    body: "Every platform streams into one queue. Nothing slips through.",
  },
  {
    title: "Everything is audited",
    body: "Who approved what, and when. Full trail for every action.",
  },
];

export function WhyItMatters() {
  return (
    <section className="py-16 md:py-24" style={{ backgroundColor: "#0A0F1E" }}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2 md:px-6">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-xl">
            <CommentEngineMock />
          </div>
        </Reveal>

        <Reveal delay={0.1} className="flex flex-col items-start gap-4">
          <Badge
            variant="outline"
            className="w-fit border-electric-500/30 bg-electric-500/10 text-electric-300"
          >
            Why it matters
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Faster replies win customers
          </h2>
          <div className="mt-2 flex flex-col gap-5">
            {POINTS.map((point) => (
              <div key={point.title} className="flex gap-3">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-electric-400" />
                <div>
                  <div className="font-semibold text-white">{point.title}</div>
                  <div className="mt-1 text-sm text-neutral-400">{point.body}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
