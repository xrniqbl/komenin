import { routeChatCompletion } from "@/lib/ai";
import {
  scanContentRisk,
  DEFAULT_BANNED,
  type RiskRuleInput,
} from "@/lib/risk-scanner";

const BANNED = DEFAULT_BANNED;

export type CommentGenerationInput = {
  postContent: string;
  goal?: string | null;
  tone?: string | null;
  agentName?: string | null;
  systemPrompt?: string | null;
  language?: string | null;
  knowledgeContext?: string[];
  skillContext?: string[];
  authorHandle?: string | null;
  platform?: string | null;
  templateBody?: string | null;
  riskRules?: RiskRuleInput[];
};

export type CommentGenerationResult = {
  content: string;
  riskFlags: string[];
  riskScore?: number;
  blocked?: boolean;
  source: "gateway" | "local_fallback" | "template";
  providerId?: string;
  model?: string;
};

function localGenerate(input: CommentGenerationInput): CommentGenerationResult {
  // If template body provided, try to render via template engine inline
  if (input.templateBody) {
    try {
      const { renderTemplate } = require("@/lib/template-engine") as typeof import("@/lib/template-engine");
      const rendered = renderTemplate(input.templateBody, {
        authorHandle: input.authorHandle || "",
        platform: input.platform || "",
        goal: input.goal || "",
        tone: input.tone || "professional",
        postSnippet: input.postContent.slice(0, 80),
        agentName: input.agentName || "Aether Agent",
        topic: input.postContent.slice(0, 60),
      });
      if (rendered.trim().length > 5) {
        const scan = scanContentRisk({
          text: rendered,
          postContent: input.postContent,
          customRules: input.riskRules,
        });
        if (scan.blocked) {
          return {
            content: "Komentar ditahan guardrail karena mengandung topik sensitif. Mohon review manual sebelum dikirim.",
            riskFlags: scan.flags,
            riskScore: scan.riskScore,
            blocked: true,
            source: "template",
          };
        }
        return {
          content: rendered,
          riskFlags: scan.flags,
          riskScore: scan.riskScore,
          source: "template",
        };
      }
    } catch {
      // fall through to local
    }
  }

  const text = input.postContent.trim().replace(/\s+/g, " ");
  const snippet = text.slice(0, 120);
  const tone = input.tone || "professional";
  const goal = input.goal || "bangun engagement relevan";
  const knowledge = input.knowledgeContext?.[0];
  const skill = input.skillContext?.[0];

  let content = "";
  if (tone === "casual") {
    content = `Menarik banget poinnya soal "${snippet}". Kalau mau, aku bisa bantu arahkan next step yang lebih praktis buat ${goal}.`;
  } else if (tone === "witty") {
    content = `Ini insight yang pas: "${snippet}". Kalau dieksekusi rapi, peluang ${goal} biasanya naik tanpa ribet.`;
  } else {
    content = `Terima kasih sudah berbagi. Poin tentang "${snippet}" relevan. Untuk ${goal}, pendekatan bertahap biasanya lebih aman dan sustainable.`;
  }

  if (knowledge) {
    content += ` Berdasarkan knowledge internal: ${knowledge.slice(0, 140)}`;
  }
  if (skill) {
    content += ` ${skill}`;
  }

  // Risk scan v2
  const scan = scanContentRisk({
    text: content,
    postContent: input.postContent,
    customRules: input.riskRules,
  });

  if (scan.blocked) {
    content = "Komentar ditahan guardrail karena mengandung topik sensitif. Mohon review manual sebelum dikirim.";
  }

  return {
    content,
    riskFlags: scan.flags.length > 0 ? scan.flags : BANNED.filter((word) => `${content} ${text}`.toLowerCase().includes(word)),
    riskScore: scan.riskScore,
    blocked: scan.blocked,
    source: "local_fallback",
  };
}

function scoreRisk(content: string, postContent: string, riskRules?: RiskRuleInput[]): string[] {
  const scan = scanContentRisk({
    text: content,
    postContent,
    customRules: riskRules,
  });
  return scan.flags;
}

export function generateContextualComment(
  input: CommentGenerationInput,
): CommentGenerationResult {
  return localGenerate(input);
}

export async function generateContextualCommentHybrid(
  input: CommentGenerationInput,
): Promise<CommentGenerationResult> {
  const language = input.language || "id";
  const tone = input.tone || "professional";
  const goal = input.goal || "bangun engagement relevan";
  const agentName = input.agentName || "Aether Agent";
  const systemPrompt =
    input.systemPrompt?.trim() ||
    `You are ${agentName}, an enterprise social operator. Write concise, natural comments. Respect brand safety. Never invent discounts, legal claims, or medical advice.`;

  const knowledgeBlock = (input.knowledgeContext || [])
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
  const skillBlock = (input.skillContext || []).join("\n");

  const routed = await routeChatCompletion({
    temperature: 0.5,
    maxTokens: 220,
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\nLanguage: ${language}\nTone: ${tone}\nOutput only the final comment text.`,
      },
      {
        role: "user",
        content: [
          `Campaign goal: ${goal}`,
          `Target post: ${input.postContent}`,
          knowledgeBlock ? `Knowledge context:\n${knowledgeBlock}` : "",
          skillBlock ? `Skill results:\n${skillBlock}` : "",
          "Write one short social comment (1-3 sentences).",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  if (routed && routed.content.trim()) {
    const content = routed.content.trim();
    const scan = scanContentRisk({
      text: content,
      postContent: input.postContent,
      customRules: input.riskRules,
    });
    if (scan.blocked) {
      return {
        content: "Komentar ditahan guardrail karena mengandung topik sensitif. Mohon review manual sebelum dikirim.",
        riskFlags: scan.flags,
        riskScore: scan.riskScore,
        blocked: true,
        source: "gateway",
        providerId: routed.providerId,
        model: routed.model,
      };
    }
    return {
      content,
      riskFlags: scan.flags,
      riskScore: scan.riskScore,
      blocked: false,
      source: "gateway",
      providerId: routed.providerId,
      model: routed.model,
    };
  }

  return localGenerate(input);
}

export function pickDelaySeconds(minDelaySec: number, maxDelaySec: number): number {
  const min = Math.max(5, minDelaySec);
  const max = Math.max(min, maxDelaySec);
  return min + Math.floor(Math.random() * (max - min + 1));
}
