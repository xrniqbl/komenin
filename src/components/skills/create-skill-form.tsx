"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSkill } from "@/server/skills";
import {
  EXECUTOR_CONFIG_HELP,
  SKILL_TEMPLATES,
  type SkillTemplate,
} from "@/lib/skills/templates";

export function CreateSkillForm() {
  const [templateKey, setTemplateKey] = useState("");
  const [executor, setExecutor] = useState<"builtin" | "webhook">("builtin");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [triggers, setTriggers] = useState("");
  const [configText, setConfigText] = useState("{}");
  const [configError, setConfigError] = useState("");
  const [formError, setFormError] = useState("");

  function applyTemplate(template: SkillTemplate) {
    setTemplateKey(template.key);
    setExecutor(template.executor);
    setName(template.name);
    setSlug(template.slug);
    setDescription(template.description);
    setTriggers(template.triggers.join(", "));
    setConfigText(JSON.stringify(template.configJson, null, 2));
    setConfigError("");
    setFormError("");
  }

  return (
    <form
      id="create-skill-form"
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const trimmed = configText.trim();
        let configJson: Record<string, unknown> = {};
        if (trimmed) {
          try {
            const parsed: unknown = JSON.parse(trimmed);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              setConfigError("Config must be a JSON object, not an array or scalar.");
              return;
            }
            configJson = parsed as Record<string, unknown>;
          } catch {
            setConfigError(
              "Invalid JSON: check quotes, commas, and brackets, then try again.",
            );
            return;
          }
        }
        setConfigError("");
        setFormError("");
        void (async () => {
          try {
            await createSkill({
              name,
              slug,
              description,
              executor,
              highRisk: data.get("highRisk") === "on",
              triggers: triggers
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              configJson,
            });
            setName("");
            setSlug("");
            setDescription("");
            setTriggers("");
            setConfigText("{}");
            setTemplateKey("");
          } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to create skill");
          }
        })();
      }}
    >
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor="skill-template">Template</Label>
        <div className="flex flex-wrap gap-2">
          {SKILL_TEMPLATES.map((template) => (
            <Button
              key={template.key}
              type="button"
              size="sm"
              variant={templateKey === template.key ? "default" : "outline"}
              onClick={() => applyTemplate(template)}
            >
              Use {template.name}
            </Button>
          ))}
        </div>
        {templateKey ? (
          <div className="text-xs text-muted-foreground">
            {SKILL_TEMPLATES.find((t) => t.key === templateKey)?.description}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Pick a template to prefill the form, or fill it in manually.
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          placeholder="slug-name"
          required
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="triggers">Triggers</Label>
        <Input
          id="triggers"
          name="triggers"
          placeholder="triggers,comma,separated"
          value={triggers}
          onChange={(event) => setTriggers(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="create-executor">Executor</Label>
        <select
          id="create-executor"
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={executor}
          onChange={(event) =>
            setExecutor(event.target.value as "builtin" | "webhook")
          }
        >
          <option value="builtin">builtin</option>
          <option value="webhook">webhook</option>
        </select>
      </div>
      <Label className="flex items-center gap-2 text-sm font-normal">
        <Checkbox name="highRisk" />
        High risk (force approval)
      </Label>
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor="create-config">Executor config (JSON)</Label>
        <Textarea
          id="create-config"
          value={configText}
          onChange={(event) => {
            setConfigText(event.target.value);
            const trimmed = event.target.value.trim();
            if (!trimmed) {
              setConfigError("");
              return;
            }
            try {
              const parsed: unknown = JSON.parse(trimmed);
              setConfigError(
                !parsed || typeof parsed !== "object" || Array.isArray(parsed)
                  ? "Config must be a JSON object, not an array or scalar."
                  : "",
              );
            } catch {
              setConfigError(
                "Invalid JSON: check quotes, commas, and brackets, then try again.",
              );
            }
          }}
          rows={5}
          className="font-mono text-xs"
          aria-invalid={configError ? true : undefined}
        />
        {configError ? (
          <div className="text-xs text-destructive">{configError}</div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          {EXECUTOR_CONFIG_HELP[executor]}
        </div>
      </div>
      {formError ? (
        <div className="text-xs text-destructive md:col-span-2">{formError}</div>
      ) : null}
      <div className="md:col-span-2">
        <Button variant="electric" type="submit" disabled={Boolean(configError)}>
          Create skill
        </Button>
      </div>
    </form>
  );
}
