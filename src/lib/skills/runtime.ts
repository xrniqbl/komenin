import { db } from "@/lib/db";

export type SkillRecord = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  executor: "builtin" | "webhook";
  configJson: unknown;
  highRisk: boolean;
  isActive: boolean;
  triggers: Array<{ id: string; pattern: string }>;
};

const DEFAULT_SKILLS = [
  {
    name: "Coupon Lookup",
    slug: "coupon-lookup",
    description: "Lookup active promo codes for engagement replies.",
    highRisk: false,
    triggers: ["coupon", "diskon", "promo", "kode"],
    configJson: {
      codes: [
        { code: "AETHER10", detail: "10% off first month" },
        { code: "GROW20", detail: "20% off annual growth plan" },
      ],
    },
  },
  {
    name: "Brand FAQ",
    slug: "brand-faq",
    description: "Answer common product FAQs from configured facts.",
    highRisk: false,
    triggers: ["harga", "price", "fitur", "feature", "apa itu"],
    configJson: {
      facts: [
        "Aether is an enterprise social operations control plane.",
        "Default campaign mode requires human approval.",
        "Hybrid connectors support simulator, webhook, and official APIs.",
      ],
    },
  },
];

export async function ensureBuiltinSkills(workspaceId: string): Promise<SkillRecord[]> {
  for (const skill of DEFAULT_SKILLS) {
    const existing = await db.skill.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: skill.slug } },
    });
    if (existing) continue;
    await db.skill.create({
      data: {
        workspaceId,
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        executor: "builtin",
        highRisk: skill.highRisk,
        configJson: skill.configJson,
        triggers: {
          create: skill.triggers.map((pattern) => ({ pattern })),
        },
      },
    });
  }

  return db.skill.findMany({
    where: { workspaceId, isActive: true },
    include: { triggers: true },
    orderBy: { createdAt: "asc" },
  });
}

export function matchSkillsForText(text: string, skills: SkillRecord[]): SkillRecord[] {
  const hay = text.toLowerCase();
  return skills.filter((skill) =>
    skill.triggers.some((trigger) => hay.includes(trigger.pattern.toLowerCase())),
  );
}

export async function runSkill(input: {
  workspaceId: string;
  skill: SkillRecord;
  agentId?: string | null;
  inputText: string;
  existingRunId?: string;
}): Promise<{ ok: boolean; outputText?: string; runId: string }> {
  const run =
    input.existingRunId
      ? await db.skillRun.update({
          where: { id: input.existingRunId },
          data: { status: "running" },
        })
      : await db.skillRun.create({
          data: {
            workspaceId: input.workspaceId,
            skillId: input.skill.id,
            agentId: input.agentId || null,
            status: "running",
            inputJson: { text: input.inputText },
          },
        });

  const steps: Array<{ title: string; detail: string }> = [
    {
      title: "Intent matched",
      detail: `Skill ${input.skill.slug} selected for input`,
    },
  ];

  let outputText = "";
  try {
    if (input.skill.executor === "builtin" && input.skill.slug === "coupon-lookup") {
      const codes =
        (input.skill.configJson as { codes?: Array<{ code: string; detail: string }> })
          ?.codes || [];
      const chosen = codes[0];
      steps.push({
        title: "Lookup coupon catalog",
        detail: `Found ${codes.length} active codes`,
      });
      outputText = chosen
        ? `Kode promo aktif: ${chosen.code} (${chosen.detail}).`
        : "Belum ada kode promo aktif.";
      steps.push({ title: "Compose coupon reply", detail: outputText });
    } else if (input.skill.executor === "builtin" && input.skill.slug === "brand-faq") {
      const facts =
        (input.skill.configJson as { facts?: string[] })?.facts || [];
      steps.push({
        title: "Retrieve FAQ facts",
        detail: `Loaded ${facts.length} facts`,
      });
      outputText = facts[0] || "FAQ belum dikonfigurasi.";
      steps.push({ title: "Compose FAQ answer", detail: outputText });
    } else if (input.skill.executor === "webhook") {
      const config = input.skill.configJson as { url?: string; token?: string } | null;
      if (!config?.url) throw new Error("Webhook skill missing url");
      steps.push({ title: "Call webhook skill", detail: config.url });
      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
        },
        body: JSON.stringify({
          skill: input.skill.slug,
          text: input.inputText,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        text?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
      }
      outputText = payload.text || payload.message || "Webhook skill completed";
      steps.push({ title: "Webhook result", detail: outputText });
    } else {
      outputText = `Skill ${input.skill.slug} executed.`;
      steps.push({ title: "Generic skill result", detail: outputText });
    }

    await db.$transaction(async (tx) => {
      await tx.skillRunStep.deleteMany({ where: { runId: run.id } });
      for (const [index, step] of steps.entries()) {
        await tx.skillRunStep.create({
          data: {
            runId: run.id,
            ordinal: index + 1,
            title: step.title,
            detail: step.detail,
            status: "ok",
          },
        });
      }
      await tx.skillRun.update({
        where: { id: run.id },
        data: {
          status: "succeeded",
          outputJson: { text: outputText },
          finishedAt: new Date(),
          error: null,
        },
      });
    });

    return { ok: true, outputText, runId: run.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Skill failed";
    await db.skillRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: message,
        finishedAt: new Date(),
      },
    });
    return { ok: false, runId: run.id };
  }
}
