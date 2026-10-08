"use client";

import ArrowForwardIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardRounded';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmailRounded';
import MenuBookIcon from '@mui/icons-material/MenuBookRounded';
import PhotoCameraIcon from '@mui/icons-material/PhotoCameraRounded';
import ForumIcon from '@mui/icons-material/ForumRounded';
import MusicNoteIcon from '@mui/icons-material/MusicNoteRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUserRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeRounded';
import LocalOfferIcon from '@mui/icons-material/LocalOfferRounded';
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { LocaleLink } from "@/components/i18n/locale-link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scrollToSection } from "@/lib/scroll-section";

export function SiteFooter() {
  const { t, locale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = React.useState("");

  function goToSection(id: "features" | "pricing") {
    if (pathname === "/" || pathname === "/id") {
      scrollToSection(id, "smooth");
      return;
    }
    router.push(`${locale === "id" ? "/id" : "/"}#${id}`);
  }

  function handleSubscribe(event: React.FormEvent) {
    event.preventDefault();
    // Newsletter belum ada backend — arahkan ke signup dengan email terisi.
    const q = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : "";
    router.push(`${locale === "id" ? "/id" : ""}/signup${q}`);
  }

  const productLinks = [
    {
      label: t.footer.features,
      icon: AutoAwesomeIcon,
      onClick: () => goToSection("features"),
      href: "/features",
    },
    {
      label: t.footer.pricing,
      icon: LocalOfferIcon,
      onClick: () => goToSection("pricing"),
      href: "/pricing",
    },
    { label: t.footer.security, icon: VerifiedUserIcon, href: "/security" },
    { label: t.footer.integrations, icon: ForumIcon, href: "/integrations" },
    { label: t.footer.docs, icon: MenuBookIcon, href: "/docs" },
  ];

  const companyLinks = [
    { label: t.footer.about, href: "/about" },
    { label: t.footer.contact, href: "/contact" },
    { label: t.footer.enterprise, href: "/enterprise" },
    { label: t.footer.useCases, href: "/use-cases" },
    { label: t.footer.changelog, href: "/changelog" },
  ];

  const legalLinks = [
    { label: t.footer.privacy, href: "/legal/privacy" },
    { label: t.footer.terms, href: "/legal/terms" },
    { label: t.footer.aup, href: "/legal/aup" },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-ink-950 text-neutral-400">
      {/* Blue glow ala video */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-[60rem] -translate-x-1/2 rounded-full bg-electric-600/15 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Account signup */}
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2">
              <Image src="/brand/komenin-robot-white.png" alt="Komenin" width={32} height={32} />
              <span className="text-base font-semibold text-white">Komenin</span>
            </div>
            <p className="max-w-xs text-sm text-neutral-500">{t.footer.blurb}</p>
            <form onSubmit={handleSubscribe} className="flex max-w-xs flex-col gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="rounded-full border-white/10 bg-white/5 text-sm text-white placeholder:text-neutral-600"
              />
              <button
                type="submit"
                style={{ background: "linear-gradient(to right, #2563eb, #2e7cf6)" }}
                className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white"
              >
                Create an account
                <ArrowForwardIcon className="size-4" />
              </button>
            </form>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-4">
            <div className="text-base font-semibold text-white">{t.footer.product}</div>
            <div className="flex flex-col items-start gap-2.5">
              {productLinks.map((link) => {
                const Icon = link.icon;
                const inner = (
                  <>
                    <Icon className="size-3.5 text-electric-400" />
                    <span className="text-sm">{link.label}</span>
                  </>
                );
                const cls =
                  "inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors";
                return link.onClick ? (
                  <button key={link.label} type="button" onClick={link.onClick} className={cls}>
                    {inner}
                  </button>
                ) : (
                  <LocaleLink key={link.label} href={link.href!} className={cls}>
                    {inner}
                  </LocaleLink>
                );
              })}
            </div>
          </div>

          {/* Company + Legal */}
          <div className="flex flex-col gap-4">
            <div className="text-base font-semibold text-white">{t.footer.company}</div>
            <div className="flex flex-col items-start gap-2.5">
              {companyLinks.map((link) => (
                <LocaleLink
                  key={link.href}
                  href={link.href}
                  className="text-sm text-neutral-500 transition-colors hover:text-neutral-200"
                >
                  {link.label}
                </LocaleLink>
              ))}
            </div>
            <div className="mt-2 text-base font-semibold text-white">{t.footer.legal}</div>
            <div className="flex flex-col items-start gap-2.5">
              {legalLinks.map((link) => (
                <LocaleLink
                  key={link.href}
                  href={link.href}
                  className="text-sm text-neutral-500 transition-colors hover:text-neutral-200"
                >
                  {link.label}
                </LocaleLink>
              ))}
            </div>
          </div>

          {/* Get started */}
          <div className="flex flex-col gap-4">
            <div className="text-base font-semibold text-white">Ready to get started?</div>
            <LocaleLink
              href="/contact"
              className="text-sm text-neutral-400 transition-colors hover:text-white"
            >
              hello@komenin.id
            </LocaleLink>
            <div className="flex items-center gap-3">
              {[
                { icon: PhotoCameraIcon, href: "/platform/instagram", label: "Instagram" },
                { icon: MusicNoteIcon, href: "/platform/tiktok", label: "TikTok" },
                { icon: AlternateEmailIcon, href: "/platform/threads", label: "Threads" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <LocaleLink
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-500 transition-colors hover:border-white/25 hover:text-white"
                  >
                    <Icon sx={{ fontSize: 15 }} />
                  </LocaleLink>
                );
              })}
            </div>
            <Button
              variant="glass"
              render={
                <LocaleLink href="/enterprise" className="inline-flex items-center gap-2" />
              }
              nativeButton={false}
              className="w-fit rounded-full px-5 py-2 text-sm"
            >
              {t.footer.enterprise}
            </Button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex items-center justify-between border-t border-white/10 pt-6">
          {/* Year is time-sensitive: server pre-render and client hydration can
              straddle midnight, so suppress the hydration warning on this
              single span rather than hiding real mismatches higher up. */}
          <span className="text-xs text-neutral-600" suppressHydrationWarning>{`© ${new Date().getFullYear()} Komenin. All rights reserved`}</span>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group inline-flex items-center gap-2 text-xs text-neutral-500 transition-colors hover:text-white"
          >
            Back to the Top
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-b from-electric-500 to-electric-700 text-white shadow-[0_0_16px_rgba(46,124,246,0.4)] transition-transform group-hover:-translate-y-0.5">
              <ArrowUpwardIcon className="size-4" />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}
