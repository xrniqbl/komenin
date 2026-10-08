"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/ui-patterns/confirm-action";
import { toastManager } from "@/components/ui/toast";
import { EXECUTOR_CONFIG_HELP } from "@/lib/skills/templates";
import { deleteSkill, updateSkill } from "@/server/skills";

type SkillShape = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  executor: "builtin" | "webhook";
  configJson: Record<string, unknown>;
  highRisk: boolean;
  isActive: boolean;
  version: number;
  triggers: Array<{ id: string; pattern: string }>;
  _count: { runs: number };
};

export function EditSkillClient({ skill }: { skill: SkillShape }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [executor, setExecutor] = useState<"builtin" | "webhook">(skill.executor);
  const [configText, setConfigText] = useState(
    JSON.stringify(skill.configJson, null, 2),
  );
  const [configError, setConfigError] = useState("");

  const configHelp = useMemo(
    () => EXECUTOR_CONFIG_HELP[executor],
    [executor],
  );

  function validateConfigJson(raw: string): {
    ok: boolean;
    value?: Record<string, unknown>;
    message?: string;
  } {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: true, value: {} };
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        message: "Invalid JSON: check quotes, commas, and brackets, then try again.",
      };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        message: "Config must be a JSON object (e.g. { \"url\": \"https://…\" }), not an array or scalar.",
      };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="error">
          <AlertTitle>Skill error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const parsed = validateConfigJson(configText);
          if (!parsed.ok) {
            setConfigError(parsed.message || "Invalid JSON");
            return;
          }
          setConfigError("");
          setError("");
          startTransition(async () => {
            try {
              await updateSkill(skill.id, {
                name: String(form.get("name") || ""),
                description: String(form.get("description") || ""),
                executor,
                highRisk: form.get("highRisk") === "on",
                isActive: form.get("isActive") === "on",
                triggers: String(form.get("triggers") || "")
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                configJson: parsed.value,
              });
              toastManager.add({ title: "Skill updated", type: "success" });
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to update skill");
            }
          });
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="skill-name">Name</Label>
          <Input id="skill-name" name="name" defaultValue={skill.name} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="skill-slug">Slug (immutable)</Label>
          <Input id="skill-slug" value={skill.slug} disabled />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="skill-description">Description</Label>
          <Input
            id="skill-description"
            name="description"
            defaultValue={skill.description || ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="skill-executor">Executor</Label>
          <select
            id="skill-executor"
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="skill-triggers">Triggers (comma separated)</Label>
          <Input
            id="skill-triggers"
            name="triggers"
            defaultValue={skill.triggers.map((t) => t.pattern).join(", ")}
          />
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox name="highRisk" defaultChecked={skill.highRisk} />
          High risk (force approval)
        </Label>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox name="isActive" defaultChecked={skill.isActive} />
          Active
        </Label>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="skill-config">Executor config (JSON)</Label>
          <Textarea
            id="skill-config"
            value={configText}
            onChange={(event) => {
              setConfigText(event.target.value);
              const check = validateConfigJson(event.target.value);
              setConfigError(check.ok ? "" : check.message || "Invalid JSON");
            }}
            rows={8}
            className="font-mono text-xs"
            aria-invalid={configError ? true : undefined}
          />
          {configError ? (
            <div className="text-xs text-destructive">{configError}</div>
          ) : null}
          <div className="text-xs text-muted-foreground">{configHelp}</div>
          {skill.executor === "webhook" && skill.configJson.hasToken ? (
            <div className="text-xs text-muted-foreground">
              A bearer token is stored (encrypted). Leave the token field out to
              keep it, or provide a new token value to replace it.
            </div>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <Button variant="electric" type="submit" disabled={pending || Boolean(configError)}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="border-t pt-6">
        <div className="text-sm font-medium text-destructive">Danger zone</div>
        <div className="mt-2 text-xs text-muted-foreground">
          Delete this skill — past runs are kept for audit, but the skill stops
          matching new input. This action cannot be undone.
        </div>
        <ConfirmAction
          title="Delete this skill?"
          description="Past runs are kept, but the skill stops matching. This cannot be undone."
          confirmLabel="Delete skill"
          destructive
          disabled={pending}
          trigger={
            <Button variant="destructive" className="mt-3">
              Delete skill
            </Button>
          }
          onConfirm={async () => {
            try {
              await deleteSkill(skill.id);
              toastManager.add({ title: "Skill deleted", type: "success" });
              router.push("/app/skills");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to delete skill");
              throw e;
            }
          }}
        />
      </div>
    </div>
  );
}
