"use client";

import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_VARIABLES,
  parseVariables,
  renderTemplate,
  sampleRenderContext,
} from "@/lib/template-engine";

type Props = {
  defaultName?: string;
  defaultBody?: string;
  defaultCategory?: string;
  onSubmit: (data: { name: string; body: string; category: string }) => void | Promise<void>;
  submitLabel?: string;
  pending?: boolean;
};

export function TemplateEditor({
  defaultName = "",
  defaultBody = "",
  defaultCategory = "general",
  onSubmit,
  submitLabel = "Save template",
  pending,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState(defaultBody);
  const [category, setCategory] = useState(defaultCategory);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const variables = parseVariables(body);
  const preview = renderTemplate(body, sampleRenderContext() as Record<string, string>);

  const insertVar = (v: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setBody((prev) => prev + `{{${v}}}`);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const newBody = `${before}{{${v}}}${after}`;
    setBody(newBody);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + v.length + 4, start + v.length + 4);
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-name">Name</Label>
          <Input
            id="t-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Friendly outreach"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-category">Category</Label>
          <Input
            id="t-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="general"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-body">Body (supports {"{{var}}"})</Label>
          <Textarea
            ref={textareaRef}
            id="t-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-40 font-mono text-sm"
            placeholder="Hi {{authorHandle}}, menarik banget poin tentang {{postSnippet}}..."
          />
        </div>

        <Card className="bg-muted/30">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Variables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="xs"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => insertVar(v)}
                >
                  {"{{"}
                  {v}
                  {"}}"}
                </Button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">Click to insert at cursor.</div>
          </CardContent>
        </Card>

        {variables.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Detected:</span>
            {variables.map((v) => (
              <Badge key={v} variant="secondary" className="text-[10px]">
                {v}
              </Badge>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          disabled={pending || !name.trim() || !body.trim()}
          onClick={() => onSubmit({ name, body, category })}
        >
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</div>
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="text-xs text-muted-foreground">
              Sample context: {JSON.stringify(sampleRenderContext(), null, 1).slice(0, 80)}…
            </div>
            <div className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm leading-relaxed">
              {preview || <span className="text-muted-foreground">(empty preview)</span>}
            </div>
          </CardContent>
        </Card>
        {variables.length > 0 ? (
          <Alert variant="warning">
            <AlertDescription>
              This template uses {variables.length} variable(s). They will be replaced at send time with
              context from the target post.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="info">
            <AlertDescription>
              Tip: add {"{{authorHandle}}"} or {"{{postSnippet}}"} to personalize replies.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}