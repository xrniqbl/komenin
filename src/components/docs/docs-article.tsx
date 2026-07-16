import Link from "next/link";
import type { DocsPage } from "@/data/docs";
import { getDocsNeighbors } from "@/data/docs";
import { DocsCopyButton } from "@/components/docs/docs-copy-button";
import { DocsPager } from "@/components/docs/docs-pager";

export function DocsArticle({
  page,
  href,
}: {
  page: DocsPage;
  href: string;
}) {
  const { prev, next } = getDocsNeighbors(href);

  return (
    <article className="min-w-0 flex-1 px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto flex max-w-6xl gap-10">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{page.title}</h1>
              <p className="mt-3 max-w-3xl text-base text-muted-foreground md:text-lg">
                {page.description}
              </p>
            </div>
            <DocsCopyButton
              title={page.title}
              description={page.description}
              sections={page.sections}
              href={href}
            />
          </div>

          <div className="mt-10 space-y-10">
            {page.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                  {section.title}
                </h2>
                {section.body ? (
                  <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
                    {section.body}
                  </p>
                ) : null}
                {section.bullets?.length ? (
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground md:text-base">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
                {section.steps?.length ? (
                  <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-muted-foreground md:text-base">
                    {section.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                ) : null}
                {section.code ? (
                  <pre className="mt-4 overflow-x-auto rounded-xl border bg-muted/40 p-4 text-xs leading-6 md:text-sm">
                    <code>{section.code}</code>
                  </pre>
                ) : null}
              </section>
            ))}
          </div>

          <DocsPager prev={prev} next={next} />

          <div className="mt-8 text-sm text-muted-foreground">
            Need the product UI?{" "}
            <Link href="/app" className="font-medium text-foreground underline-offset-4 hover:underline">
              Open command center
            </Link>
            {" · "}
            <Link href="/docs/tutorial/faq" className="font-medium text-foreground underline-offset-4 hover:underline">
              FAQ
            </Link>
          </div>
        </div>

        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-28">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              On this page
            </div>
            <div className="mt-3 space-y-2">
              {page.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
