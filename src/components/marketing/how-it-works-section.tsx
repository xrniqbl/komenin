"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { gsap, prefersReducedMotion } from "./gsap-setup";
import { Reveal } from "./reveal";

export function HowItWorksSection() {
  const { t } = useLocale();
  const copy = t.howItWorks;
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // Thin electric-blue progress bar fills as the steps scroll through.
      gsap.fromTo(
        ".hiw-progress",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".hiw-steps",
            start: "top 80%",
            end: "bottom 45%",
            scrub: 1,
          },
        },
      );

      // Steps activate one after another, tied to scroll position.
      gsap.from(".hiw-step", {
        y: 48,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
        stagger: 0.5,
        scrollTrigger: {
          trigger: ".hiw-steps",
          start: "top 80%",
          end: "top 25%",
          scrub: 1,
        },
      });
    },
    { scope },
  );

  return (
    <section ref={scope} className="py-16 md:py-24" style={{ backgroundColor: "#0A0F1E" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:px-6">
        <Reveal className="flex max-w-2xl flex-col items-start gap-4">
          <Badge variant="outline" className="w-fit border-electric-500/30 bg-electric-500/10 text-electric-300">
            How it works
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {copy.title}
          </h2>
          <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="hiw-progress h-full w-full origin-left rounded-full bg-electric-600" />
          </div>
        </Reveal>

        <div className="hiw-steps grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.steps.map((step, index) => (
            <div
              key={step}
              className="hiw-step relative overflow-hidden glass rounded-2xl p-6"
            >
              <span className="inline-flex rounded-full bg-electric-600 px-3 py-1 text-xs font-semibold text-white">
                {copy.step} {index + 1}
              </span>
              <p className="mt-4 text-sm leading-relaxed text-neutral-300">{step}</p>
              {index < copy.steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className="absolute top-1/2 -right-2 hidden h-px w-4 bg-electric-300 lg:block"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
