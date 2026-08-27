"use client";

import Image from "next/image";
import Link from "next/link";
import { LocaleLink } from "@/components/i18n/locale-link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { rememberSection, scrollToSection } from "@/lib/scroll-section";

type FooterLink =
  | { kind: "section"; id: "features" | "pricing"; label: string }
  | { kind: "route"; href: string; label: string };

export function SiteFooter() {
  const { t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const columns: Array<{ title: string; links: FooterLink[] }> = [
    {
      title: t.footer.product,
      links: [
        { kind: "section", id: "features", label: t.footer.features },
        { kind: "section", id: "pricing", label: t.footer.pricing },
        { kind: "route", href: "/security", label: t.footer.security },
        { kind: "route", href: "/docs", label: t.footer.docs },
      ],
    },
    {
      title: t.footer.company,
      links: [
        { kind: "route", href: "/about", label: t.footer.about },
        { kind: "route", href: "/contact", label: t.footer.contact },
        { kind: "route", href: "/enterprise", label: t.footer.enterprise },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { kind: "route", href: "/legal/privacy", label: t.footer.privacy },
        { kind: "route", href: "/legal/terms", label: t.footer.terms },
        { kind: "route", href: "/legal/aup", label: t.footer.aup },
      ],
    },
  ];

  function goToSection(id: "features" | "pricing") {
    if (pathname === "/") {
      scrollToSection(id, "smooth");
      return;
    }
    rememberSection(id);
    router.push("/");
  }

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 md:grid-cols-4 md:px-6">
        <div className="flex flex-col gap-4">
          <div className="inline-flex items-center gap-2">
            <Image src="/brand/komenin-mono.svg" alt="Komenin" width={24} height={24} />
            <span className="text-base font-semibold">Komenin</span>
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">{t.footer.blurb}</p>
        </div>
        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <div className="text-sm font-semibold">{column.title}</div>
            <div className="flex flex-col items-start gap-1">
              {column.links.map((link) =>
                link.kind === "section" ? (
                  <Button
                    key={link.id}
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => goToSection(link.id)}
                    className="h-auto px-0 text-muted-foreground"
                  >
                    {link.label}
                  </Button>
                ) : (
                  <Button
                    key={link.href}
                    variant="link"
                    size="sm"
                    render={<LocaleLink href={link.href} />}
                    nativeButton={false}
                    className="h-auto px-0 text-muted-foreground"
                  >
                    {link.label}
                  </Button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="mx-auto flex max-w-6xl items-center px-4 py-6 text-xs text-muted-foreground md:px-6">
        <span>{`© ${new Date().getFullYear()} Komenin`}</span>
      </div>
    </footer>
  );
}
