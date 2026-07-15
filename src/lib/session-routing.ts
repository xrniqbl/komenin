import type { Platform, SocialAccountStatus } from "@prisma/client";

export function platformLabel(platform: Platform): string {
  switch (platform) {
    case "instagram":
      return "Instagram";
    case "threads":
      return "Threads";
    case "tiktok":
      return "TikTok";
    default:
      return platform;
  }
}

export function statusTone(status: SocialAccountStatus): string {
  switch (status) {
    case "healthy":
      return "var(--signal-ok)";
    case "degraded":
    case "connecting":
      return "var(--signal-warn)";
    case "limited":
    case "banned":
      return "var(--signal-danger)";
    default:
      return "var(--ink-500)";
  }
}

export function simulateIp(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const a = 10 + (hash % 200);
  const b = (hash >>> 8) % 256;
  const c = (hash >>> 16) % 256;
  const d = 1 + ((hash >>> 24) % 254);
  return [a, b, c, d].join(".");
}
