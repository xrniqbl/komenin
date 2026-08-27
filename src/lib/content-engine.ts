import { routeChatCompletion } from "@/lib/ai";

export type ContentIntervalUnit = "minutes" | "hours" | "days";

export type GeneratedContentPost = {
  sequence: number;
  title: string;
  body: string;
  hashtags: string[];
  providerId?: string;
  model?: string;
  source: "gateway" | "local_fallback";
};

function intervalToMs(value: number, unit: ContentIntervalUnit): number {
  const safe = Math.max(1, value);
  if (unit === "minutes") return safe * 60_000;
  if (unit === "hours") return safe * 3_600_000;
  return safe * 86_400_000;
}

export function buildContentSchedule(input: {
  startAt: Date;
  postCount: number;
  intervalValue: number;
  intervalUnit: ContentIntervalUnit;
}): Date[] {
  const count = Math.max(1, Math.min(input.postCount, 50));
  const step = intervalToMs(input.intervalValue, input.intervalUnit);
  return Array.from({ length: count }, (_, index) => new Date(input.startAt.getTime() + index * step));
}

function localBatch(input: {
  topic: string;
  postCount: number;
  platform: string;
  language?: string | null;
}): GeneratedContentPost[] {
  const topic = input.topic.trim();
  const language = input.language || "id";
  const count = Math.max(1, Math.min(input.postCount, 50));
  const posts: GeneratedContentPost[] = [];

  for (let i = 1; i <= count; i += 1) {
    const title =
      language === "en"
        ? `${topic}: practical takeaway #${i}`
        : `${topic}: insight praktis #${i}`;
    const body =
      language === "en"
        ? `Let's talk about ${topic}. Point #${i}: start small, measure results, then scale what works on ${input.platform}.`
        : `Bahas ${topic}. Poin #${i}: mulai dari langkah kecil, ukur hasilnya, lalu scale yang paling efektif di ${input.platform}.`;
    posts.push({
      sequence: i,
      title,
      body,
      hashtags: [topic.split(/\s+/)[0]?.replace(/[^\w]/g, "") || "growth", input.platform, "komenin"].filter(Boolean),
      source: "local_fallback",
    });
  }
  return posts;
}

function parseBatch(raw: string, postCount: number): GeneratedContentPost[] | null {
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end < 0) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.slice(0, postCount).map((item, index) => ({
      sequence: index + 1,
      title: String(item.title || `Post ${index + 1}`).trim(),
      body: String(item.body || item.content || "").trim(),
      hashtags: Array.isArray(item.hashtags)
        ? item.hashtags.map(String).filter(Boolean).slice(0, 8)
        : [],
      source: "gateway" as const,
    })).filter((item) => item.body.length > 0);
  } catch {
    return null;
  }
}

export async function generateContentPosts(input: {
  topic: string;
  postCount: number;
  platform: string;
  language?: string | null;
  tone?: string | null;
  systemPrompt?: string | null;
  agentName?: string | null;
  workspaceId?: string | null;
  preferredProviderId?: string | null;
  preferredModel?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
}): Promise<GeneratedContentPost[]> {
  const count = Math.max(1, Math.min(input.postCount, 50));
  const language = input.language || "id";
  const tone = input.tone || "professional";
  const agentName = input.agentName || "Komenin Content Agent";
  const systemPrompt =
    input.systemPrompt?.trim() ||
    `You are ${agentName}, an enterprise social content strategist. Write concise original posts. Avoid spammy claims.`;

  let providers = undefined as Awaited<
    ReturnType<typeof import("@/server/ai-providers").loadRuntimeAiProviders>
  >["providers"] | undefined;
  let preferredProviderId = input.preferredProviderId;
  let preferredModel = input.preferredModel;
  let temperature = input.temperature ?? 0.7;
  let maxTokens = input.maxTokens ?? 1800;
  if (input.workspaceId) {
    try {
      const { loadRuntimeAiProviders } = await import("@/server/ai-providers");
      const runtime = await loadRuntimeAiProviders(input.workspaceId);
      providers = runtime.providers;
      preferredProviderId = preferredProviderId || runtime.defaultProviderId;
      preferredModel = preferredModel || runtime.defaultModel;
      if (input.temperature == null) temperature = runtime.temperature;
      if (input.maxTokens == null) maxTokens = Math.max(runtime.maxTokens, 800);
    } catch {
      // env bootstrap
    }
  }

  const routed = await routeChatCompletion({
    providers,
    preferredProviderId,
    preferredModel,
    temperature,
    maxTokens,
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\nLanguage: ${language}\nTone: ${tone}\nReturn ONLY valid JSON array.`,
      },
      {
        role: "user",
        content: [
          `Create ${count} original social posts about: ${input.topic}`,
          `Platform: ${input.platform}`,
          "Each item must be an object with keys: title, body, hashtags (string array).",
          "Make each post unique angle/subtopic, practical, and publish-ready.",
          "No markdown fences.",
        ].join("\n"),
      },
    ],
  });

  if (routed?.content) {
    const parsed = parseBatch(routed.content, count);
    if (parsed && parsed.length > 0) {
      return parsed.map((item) => ({
        ...item,
        providerId: routed.providerId,
        model: routed.model,
        source: "gateway",
      }));
    }
  }

  return localBatch({
    topic: input.topic,
    postCount: count,
    platform: input.platform,
    language,
  });
}