"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectPopup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/ui-patterns/confirm-action";
import { toastManager } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import {
  createRiskRule,
  deleteRiskRule,
  updateRiskRule,
} from "@/server/risk-rules";

type Rule = {
  id: string;
  type: string;
  pattern: string;
  severity: string;
  isActive: boolean;
  createdAt: Date | string;
};

const TYPE_OPTIONS = [
  { value: "banned_phrase", label: "Banned phrase" },
  { value: "custom", label: "Custom (exact or /regex/)" },
];

const SEV_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High (blocks)" },
];

export function RiskRulesManager({ rules: initial }: { rules: Rule[] }) {
  const [pattern, setPattern] = useState("");
  const [type, setType] = useState("banned_phrase");
  const [severity, setSeverity] = useState("medium");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!pattern.trim()) {
      setError("Pattern required");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await createRiskRule({ type, pattern: pattern.trim(), severity });
        setPattern("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create");
      }
    });
  };

  const toggleActive = (id: string, active: boolean) => {
    startTransition(async () => {
      try {
        await updateRiskRule(id, { isActive: !active });
        toastManager.add({
          title: active ? "Rule disabled" : "Rule enabled",
          type: "success",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update");
      }
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRiskRule(id);
      toastManager.add({ title: "Risk rule deleted", type: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-background p-5">
        <div className="text-sm font-medium">Add rule</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => { if (v) setType(v); }}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectPopup>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => { if (v) setSeverity(v); }}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectPopup>
                {SEV_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Actions</Label>
            <Button onClick={handleCreate} disabled={pending} className="w-full">
              {pending ? "..." : "Add rule"}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="rr-pattern">Pattern</Label>
          <Textarea
            id="rr-pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder='e.g. "investasi bodong" or /skema\s*cepat\s*kaya/i'
            className="min-h-20 font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground">
            Banned phrase matches substring (case-insensitive). Custom may be exact string or a JS regex literal like <code className="rounded bg-muted px-1">/bad\s*word/i</code>.
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Built-in promo claim detector always active: patterns like <code>gratis 100%</code>, <code>dijamin untung</code>, <code>100% berhasil</code>, etc. These require no custom rule.
        </div>
      </div>

      <div className="rounded-2xl border bg-background">
        {initial.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No custom risk rules yet. Add your first above.
          </div>
        ) : (
          <div className="divide-y">
            {initial.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={rule.isActive ? "secondary" : "outline"}>{rule.type}</Badge>
                    <Badge variant={rule.severity === "high" ? "destructive" : rule.severity === "medium" ? "default" : "outline"} className="text-[10px]">
                      {rule.severity}
                    </Badge>
                    {!rule.isActive ? <Badge variant="outline">inactive</Badge> : null}
                  </div>
                  <div className="mt-2 font-mono text-sm">{rule.pattern}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {typeof rule.createdAt === "string" ? rule.createdAt : rule.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC
                  </div>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={rule.isActive}
                      disabled={pending}
                      onCheckedChange={() => toggleActive(rule.id, rule.isActive)}
                      aria-label={rule.isActive ? "Disable rule" : "Enable rule"}
                    />
                    {rule.isActive ? "Active" : "Inactive"}
                  </label>
                  <ConfirmAction
                    title="Delete risk rule?"
                    description="This guardrail will stop applying to future drafts."
                    confirmLabel="Delete rule"
                    destructive
                    disabled={pending}
                    trigger={<Button size="sm" variant="outline">Delete</Button>}
                    onConfirm={() => handleDelete(rule.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
