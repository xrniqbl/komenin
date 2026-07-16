export const TEMPLATE_VARIABLES = [
  "authorHandle",
  "platform",
  "goal",
  "tone",
  "postSnippet",
  "agentName",
  "workspaceName",
  "topic",
] as const;

export type TemplateVar = (typeof TEMPLATE_VARIABLES)[number];

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

export function parseVariables(body: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_REGEX.source, "g");
  while ((match = re.exec(body)) !== null) {
    if (match[1]) found.add(match[1]);
  }
  return Array.from(found).sort();
}

export function renderTemplate(
  body: string,
  ctx: Record<string, string | null | undefined>,
): string {
  return body.replace(VARIABLE_REGEX, (_full, key: string) => {
    const val = ctx[key];
    if (val == null) return "";
    return String(val);
  });
}

export function sampleRenderContext(): Record<string, string> {
  return {
    authorHandle: "techfounder_42",
    platform: "instagram",
    goal: "build trust with early adopters",
    tone: "professional",
    postSnippet: "Baru bahas AI infra scaling...",
    agentName: "Sales Assist",
    workspaceName: "Acme Growth",
    topic: "AI infrastructure cost optimization",
  };
}

export function countVariableUsages(body: string, varName: string): number {
  const re = new RegExp(`\\{\\{${varName}\\}\\}`, "g");
  return (body.match(re) || []).length;
}
