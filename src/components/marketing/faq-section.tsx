import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Is automation fully automatic?",
    a: "Default campaign mode requires human approval before send.",
  },
  {
    q: "Which platforms are supported?",
    a: "Instagram, Threads, and TikTok are in the MVP platform model.",
  },
  {
    q: "How do you handle security?",
    a: "Workspace RBAC, encrypted secrets, and append-only audit logs.",
  },
  {
    q: "Do you support enterprise sales?",
    a: "Yes. Hybrid GTM includes self-serve and enterprise paths.",
  },
];

export function FaqSection() {
  return (
    <section className="bg-muted/30 py-16 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">FAQ</h2>
        <Accordion type="single" collapsible className="w-full rounded-xl border bg-card px-4">
          {faqs.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
