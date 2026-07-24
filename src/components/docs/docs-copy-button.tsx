"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

function pageToMarkdown(input: {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    body?: string;
    bullets?: string[];
    steps?: string[];
    code?: string;
  }>;
  href: string;
}) {
  const lines: string[] = [];
  lines.push(`# ${input.title}`, "", input.description, "");
  for (const section of input.sections) {
    lines.push(`## ${section.title}`, "");
    if (section.body) lines.push(section.body, "");
    if (section.bullets?.length) {
      for (const bullet of section.bullets) lines.push(`- ${bullet}`);
      lines.push("");
    }
    if (section.steps?.length) {
      section.steps.forEach((step, index) => {
        lines.push(`${index + 1}. ${step}`);
      });
      lines.push("");
    }
    if (section.code) {
      lines.push("```", section.code, "```", "");
    }
  }
  lines.push(`Source: ${input.href}`);
  return lines.join("\n");
}

export function DocsCopyButton({
  title,
  description,
  sections,
  href,
}: {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    body?: string;
    bullets?: string[];
    steps?: string[];
    code?: string;
  }>;
  href: string;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = React.useState(false);

  async function onCopy() {
    const markdown = pageToMarkdown({ title, description, sections, href });
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      const el = document.createElement("textarea");
      el.value = markdown;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onCopy}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? t.docsUi.copied : t.docsUi.copyPage}
    </Button>
  );
}
