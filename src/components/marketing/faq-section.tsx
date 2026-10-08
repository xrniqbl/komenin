"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

export function FaqSection() {
  const { t } = useLocale();

  return (
    <section className="py-16 md:py-24" style={{ backgroundColor: "#0A0F1E" }}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-electric-300">{t.faq.kicker}</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {t.faq.title}
          </h2>
          <p className="max-w-xl text-base text-neutral-400">{t.faq.subtitle}</p>
        </div>

        <Card className="glass rounded-2xl">
          <CardContent className="px-4 py-0">
            <Accordion className="w-full">
              {t.faq.items.map((item, index) => (
                <AccordionItem key={item.q} value={`item-${index}`} className="border-white/10">
                  <AccordionTrigger className="text-left text-white hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-neutral-400">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
