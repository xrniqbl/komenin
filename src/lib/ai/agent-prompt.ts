export type AgentPersonalityInput = {
  name?: string | null;
  tone?: string | null;
  language?: string | null;
  systemPrompt?: string | null;
  style?: string | null;
  formality?: string | null;
  emojiPolicy?: string | null;
  ctaStyle?: string | null;
  maxSentences?: number | null;
  bannedTopics?: string[] | null;
  mustInclude?: string[] | null;
};

/**
 * Compose a single system prompt from agent base prompt + characteristics.
 */
export function buildAgentSystemPrompt(agent: AgentPersonalityInput): string {
  const name = agent.name?.trim() || "Komenin Agent";
  const base =
    agent.systemPrompt?.trim() ||
    `You are ${name}, an enterprise social operator. Write concise, natural comments. Respect brand safety. Never invent discounts, legal claims, or medical advice.`;

  const lines = [
    base,
    `Language: ${agent.language || "id"}`,
    `Tone: ${agent.tone || "professional"}`,
    `Style: ${agent.style || "balanced"}`,
    `Formality: ${agent.formality || "neutral"}`,
    `Emoji policy: ${agent.emojiPolicy || "light"}`,
    `CTA style: ${agent.ctaStyle || "soft"}`,
    `Max sentences: ${agent.maxSentences ?? 3}`,
  ];

  if (agent.bannedTopics && agent.bannedTopics.length > 0) {
    lines.push(`Never mention: ${agent.bannedTopics.join(", ")}`);
  }
  if (agent.mustInclude && agent.mustInclude.length > 0) {
    lines.push(`When natural, include: ${agent.mustInclude.join(", ")}`);
  }

  lines.push("Output only the final comment text with no quotes or preamble.");
  return lines.join("\n");
}
