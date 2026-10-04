import type { Platform } from "@prisma/client";

export type CampaignTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "engagement" | "leads" | "brand" | "support";
  platform: Platform;
  goal: string;
  dailyLimit: number;
  minDelaySec: number;
  maxDelaySec: number;
  listenerQuery: string;
  tags: string[];
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  // --- Instagram ---
  {
    id: "ig-engagement-boost",
    name: "Engagement Booster",
    description:
      "Auto-comment on trending posts in your niche. AI drafts friendly, on-brand replies that spark conversations.",
    icon: "💬",
    category: "engagement",
    platform: "instagram",
    goal: "Increase brand visibility and drive profile visits through strategic commenting",
    dailyLimit: 30,
    minDelaySec: 300,
    maxDelaySec: 900,
    listenerQuery: "",
    tags: ["popular", "beginner-friendly"],
  },
  {
    id: "ig-lead-capture",
    name: "Lead Magnet",
    description:
      "Target posts where users ask for recommendations. AI replies with helpful info + soft CTA to your link.",
    icon: "🎯",
    category: "leads",
    platform: "instagram",
    goal: "Capture leads by replying to intent-rich posts with value-first comments",
    dailyLimit: 20,
    minDelaySec: 300,
    maxDelaySec: 1200,
    listenerQuery: "rekomendasi OR recommend OR looking for",
    tags: ["high-roi"],
  },
  {
    id: "ig-brand-awareness",
    name: "Brand Amplifier",
    description:
      "Comment on competitor posts and industry leaders. Build brand recall by being present in relevant conversations.",
    icon: "📢",
    category: "brand",
    platform: "instagram",
    goal: "Build brand awareness through presence in industry conversations",
    dailyLimit: 15,
    minDelaySec: 600,
    maxDelaySec: 1800,
    listenerQuery: "",
    tags: ["agency-favorite"],
  },
  {
    id: "ig-support-responder",
    name: "Support Responder",
    description:
      "Monitor brand mentions and quickly respond. AI drafts empathetic, helpful replies to customer queries.",
    icon: "🛟",
    category: "support",
    platform: "instagram",
    goal: "Respond quickly to brand mentions and customer inquiries",
    dailyLimit: 50,
    minDelaySec: 180,
    maxDelaySec: 600,
    listenerQuery: "",
    tags: ["customer-success"],
  },
  // --- TikTok ---
  {
    id: "tt-engagement-boost",
    name: "TikTok Commenter",
    description:
      "Jump into viral TikTok conversations. AI drafts witty, platform-native comments that match TikTok's tone.",
    icon: "🎵",
    category: "engagement",
    platform: "tiktok",
    goal: "Drive profile visits through engaging comments on trending TikTok videos",
    dailyLimit: 25,
    minDelaySec: 300,
    maxDelaySec: 900,
    listenerQuery: "",
    tags: ["trending"],
  },
  {
    id: "tt-lead-capture",
    name: "TikTok Lead Finder",
    description:
      "Target TikTok videos where users seek product recommendations. AI replies with value-driven comments.",
    icon: "🔍",
    category: "leads",
    platform: "tiktok",
    goal: "Capture TikTok leads through helpful replies on recommendation-seeking videos",
    dailyLimit: 15,
    minDelaySec: 300,
    maxDelaySec: 1200,
    listenerQuery: "butuh OR rekomendasi OR minta saran",
    tags: ["high-roi"],
  },
  // --- Threads ---
  {
    id: "th-engagement-boost",
    name: "Threads Conversationalist",
    description:
      "Engage in thoughtful Threads discussions. AI drafts insightful replies that build your authority.",
    icon: "🧵",
    category: "engagement",
    platform: "threads",
    goal: "Build thought leadership through quality conversations on Threads",
    dailyLimit: 20,
    minDelaySec: 300,
    maxDelaySec: 900,
    listenerQuery: "",
    tags: ["thought-leadership"],
  },
  {
    id: "th-brand-awareness",
    name: "Threads Brand Voice",
    description:
      "Establish your brand voice on Threads. AI comments align with your brand personality and industry expertise.",
    icon: "✨",
    category: "brand",
    platform: "threads",
    goal: "Build consistent brand presence and authority on Threads",
    dailyLimit: 15,
    minDelaySec: 600,
    maxDelaySec: 1800,
    listenerQuery: "",
    tags: ["brand-building"],
  },
];

export function getTemplatesByPlatform(platform: Platform): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter((t) => t.platform === platform);
}

export function getTemplateById(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}

export function getTemplateCategories(): { value: CampaignTemplate["category"]; label: string; icon: string }[] {
  return [
    { value: "engagement", label: "Engagement", icon: "💬" },
    { value: "leads", label: "Lead Generation", icon: "🎯" },
    { value: "brand", label: "Brand Awareness", icon: "📢" },
    { value: "support", label: "Customer Support", icon: "🛟" },
  ];
}
