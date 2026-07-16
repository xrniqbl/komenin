import { LocaleProvider } from "@/components/i18n/locale-provider";
import { HomeSectionScroll } from "@/components/marketing/home-section-scroll";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <div className="min-h-screen bg-background text-foreground">
        <HomeSectionScroll />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </LocaleProvider>
  );
}
