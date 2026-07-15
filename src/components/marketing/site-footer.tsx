import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/enterprise", label: "Enterprise" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/aup", label: "AUP" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div className="flex flex-col gap-3">
          <div className="text-base font-semibold">Aether</div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Quiet control plane for enterprise social engagement operations.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <div className="text-sm font-semibold">{column.title}</div>
            <div className="flex flex-col gap-2">
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-xs text-muted-foreground md:px-6">
        <span>© {new Date().getFullYear()} Aether</span>
        <span>Built with free shadcn + @coss/style</span>
      </div>
    </footer>
  );
}
