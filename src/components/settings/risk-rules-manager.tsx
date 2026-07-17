"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
        <Alert variant="error">
          <AlertTitle>Risk rule error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add rule</CardTitle>
          <CardDescription>
            Banned phrase matches substring (case-insensitive). Custom may be exact string or a JS regex literal like{" "}
            <code className="rounded bg-muted px-1">/bad\s*word/i</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="rr-pattern">Pattern</Label>
            <Textarea
              id="rr-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder='e.g. "investasi bodong" or /skema\s*cepat\s*kaya/i'
              className="min-h-20 font-mono text-sm"
            />
          </div>
          <Alert variant="info">
            <AlertDescription>
              Built-in promo claim detector always active: patterns like <code>gratis 100%</code>, <code>dijamin untung</code>, <code>100% berhasil</code>, etc.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom rules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initial.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>No custom risk rules yet</EmptyTitle>
                <EmptyDescription>Add your first rule above to extend the built-in scanner.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {initial.map((rule) => (
                <div key={rule.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={rule.isActive ? "secondary" : "outline"}>{rule.type}</Badge>
                      <Badge
                        variant={rule.severity === "high" ? "destructive" : rule.severity === "medium" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {rule.severity}
                      </Badge>
                      {!rule.isActive ? <Badge variant="outline">inactive</Badge> : null}
                    </div>
                    <div className="mt-2 font-mono text-sm">{rule.pattern}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {typeof rule.createdAt === "string"
                        ? rule.createdAt
                        : rule.createdAt.toISOString().slice(0, 19).replace("T", " ")}{" "}
                      UTC
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Label className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      <Switch
                        checked={rule.isActive}
                        disabled={pending}
                        onCheckedChange={() => toggleActive(rule.id, rule.isActive)}
                        aria-label={rule.isActive ? "Disable rule" : "Enable rule"}
                      />
                      {rule.isActive ? "Active" : "Inactive"}
                    </Label>
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
        </CardContent>
      </Card>
    </div>
  );
}