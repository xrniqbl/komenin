import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FormSelect } from "@/components/ui/form-select";
import type { TriageSignals } from "@/lib/triage-signals";

export type AssigneeOption = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

function initials(name: string | null, email: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AssigneeBadge({
  assignee,
}: {
  assignee: AssigneeOption | null;
}) {
  if (!assignee) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Unassigned
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar size="sm">
        {assignee.image ? (
          <AvatarImage src={assignee.image} alt={assignee.name || assignee.email} />
        ) : null}
        <AvatarFallback>{initials(assignee.name, assignee.email)}</AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground">
        {assignee.name || assignee.email}
      </span>
    </span>
  );
}

export function RiskBadges({ triage }: { triage: TriageSignals }) {
  if (triage.riskScore <= 0 && !triage.overdue) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {triage.riskScore > 0 ? (
        <Badge
          variant={triage.highRisk ? "destructive" : "outline"}
          className="text-[10px]"
          title={triage.highRisk ? "High-risk flags present" : "Risk flags present"}
        >
          risk {Math.round(triage.riskScore * 100)}%
        </Badge>
      ) : null}
      {triage.overdue ? (
        <Badge variant="destructive" className="text-[10px]" title="Drafted over 24h ago without action">
          overdue
        </Badge>
      ) : null}
    </span>
  );
}

export function DraftList({
  drafts,
  emptyLabel,
}: {
  drafts: Array<{
    id: string;
    content: string;
    status: string;
    riskFlags: string[];
    createdAt: Date;
  }>;
  emptyLabel: string;
}) {
  if (drafts.length === 0) {
    return <div className="text-xs text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <div key={draft.id} className="rounded-lg bg-muted/30 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Draft · {draft.status}
            </span>
            {draft.riskFlags.length > 0 ? (
              <span title={draft.riskFlags.join(", ")}>
                ⚑ {draft.riskFlags.length} flag{draft.riskFlags.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <span>
              {new Date(draft.createdAt).toISOString().slice(0, 16).replace("T", " ")}
            </span>
          </div>
          <div className="mt-1 whitespace-pre-wrap">{draft.content}</div>
        </div>
      ))}
    </div>
  );
}

export function AssigneeSelect({
  id,
  name,
  defaultValue,
  members,
  unassignedLabel,
}: {
  id: string;
  name: string;
  defaultValue: string;
  members: AssigneeOption[];
  unassignedLabel: string;
}) {
  return (
    <FormSelect
      id={id}
      name={name}
      defaultValue={defaultValue}
      options={[
        { value: "", label: unassignedLabel },
        ...members.map((member) => ({
          value: member.id,
          label: member.name ? `${member.name} (${member.email})` : member.email,
        })),
      ]}
      className="h-8 text-xs"
    />
  );
}

export function TemplateSelect({
  id,
  name,
  templates,
  placeholder,
}: {
  id: string;
  name: string;
  templates: Array<{ id: string; name: string }>;
  placeholder: string;
}) {
  return (
    <FormSelect
      id={id}
      name={name}
      defaultValue=""
      placeholder={placeholder}
      options={templates.map((template) => ({
        value: template.id,
        label: template.name,
      }))}
      className="h-8 text-xs"
    />
  );
}
