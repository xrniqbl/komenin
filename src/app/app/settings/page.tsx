import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";

const links = [
  { href: "/app/settings/general", label: "General" },
  { href: "/app/settings/team", label: "Team" },
  { href: "/app/settings/billing", label: "Billing" },
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Manage workspace configuration." />
      <div className="grid gap-3 md:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border bg-background p-5 font-medium hover:border-brand"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
