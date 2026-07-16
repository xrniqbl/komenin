import { DocsMobileNav } from "@/components/docs/docs-mobile-nav";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsTopNav } from "@/components/docs/docs-top-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DocsTopNav />
      <DocsMobileNav />
      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 border-r bg-background md:block">
          <DocsSidebar />
        </aside>
        {children}
      </div>
    </div>
  );
}
