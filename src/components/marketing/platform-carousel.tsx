"use client";

import AlternateEmailIcon from '@mui/icons-material/AlternateEmailRounded';
import PhotoCameraIcon from '@mui/icons-material/PhotoCameraRounded';
import MusicNoteIcon from '@mui/icons-material/MusicNoteRounded';
import { Badge } from "@/components/ui/badge";
import { Reveal } from "./reveal";

const PLATFORMS = [
  {
    icon: PhotoCameraIcon,
    name: "Instagram",
    desc: "Auto-reply to comments and mentions on posts and Reels.",
    href: "/platform/instagram",
  },
  {
    icon: AlternateEmailIcon,
    name: "Threads",
    desc: "Join conversations and grow your Threads presence on autopilot.",
    href: "/platform/threads",
  },
  {
    icon: MusicNoteIcon,
    name: "TikTok",
    desc: "Catch viral moments and respond before they fade.",
    href: "/platform/tiktok",
  },
];

export function PlatformCarousel() {
  return (
    <section className="relative overflow-hidden bg-ink-950 py-16 md:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-96 w-[50rem] -translate-x-1/2 rounded-full bg-electric-600/10 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 md:px-6">
        <Reveal className="flex max-w-2xl flex-col items-start gap-4">
          <Badge
            variant="outline"
            className="w-fit border-electric-500/30 bg-electric-500/10 text-electric-300"
          >
            Platforms
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Built for where conversations happen
          </h2>
          <p className="text-lg text-neutral-400">
            One approval queue for every platform you operate on.
          </p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3">
          {PLATFORMS.map((platform, index) => {
            const Icon = platform.icon;
            return (
              <Reveal key={platform.name} delay={index * 0.08} className="h-full">
                <a
                  href={platform.href}
                  className="group flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-ink-900 p-6 transition-all hover:-translate-y-1 hover:border-electric-500/30 hover:shadow-[0_0_40px_rgba(46,124,246,0.15)] md:p-8"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500 to-electric-700 shadow-[0_0_24px_rgba(46,124,246,0.4)]">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{platform.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">{platform.desc}</p>
                  </div>
                  <span className="mt-auto text-sm font-medium text-electric-300 group-hover:text-white">
                    Learn more →
                  </span>
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
