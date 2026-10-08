"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "./gsap-setup";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Extra stagger delay in seconds — handy inside lists. */
  delay?: number;
  /** Vertical travel distance in px. */
  y?: number;
};

/**
 * Fade-and-rise scroll reveal wrapper. Renders a plain div, so layout
 * classes (grid spans, h-full, …) go through className.
 */
export function Reveal({ children, className, delay = 0, y = 36 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      gsap.from(el, {
        y,
        opacity: 0,
        duration: 0.8,
        delay,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    },
    { scope: ref, dependencies: [delay, y] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
