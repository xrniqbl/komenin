const BANNED = ["judi", "porn", "xxx", "scam", "gratis 100%"];

export function generateContextualComment(input: {
  postContent: string;
  goal?: string | null;
  tone?: string | null;
  agentName?: string | null;
}): { content: string; riskFlags: string[] } {
  const text = input.postContent.trim().replace(/\s+/g, " ");
  const snippet = text.slice(0, 120);
  const tone = input.tone || "professional";
  const goal = input.goal || "bangun engagement relevan";

  let content = "";
  if (tone === "casual") {
    content = `Menarik banget poinnya soal "${snippet}". Kalau mau, aku bisa bantu arahkan next step yang lebih praktis buat ${goal}.`;
  } else if (tone === "witty") {
    content = `Ini insight yang pas: "${snippet}". Kalau dieksekusi rapi, peluang ${goal} biasanya naik tanpa ribet.`;
  } else {
    content = `Terima kasih sudah berbagi. Poin tentang "${snippet}" relevan. Untuk ${goal}, pendekatan bertahap biasanya lebih aman dan sustainable.`;
  }

  const riskFlags = BANNED.filter((word) =>
    `${content} ${text}`.toLowerCase().includes(word),
  );

  if (riskFlags.length > 0) {
    content =
      "Komentar ditahan guardrail karena mengandung topik sensitif. Mohon review manual sebelum dikirim.";
  }

  return { content, riskFlags };
}

export function pickDelaySeconds(minDelaySec: number, maxDelaySec: number): number {
  const min = Math.max(5, minDelaySec);
  const max = Math.max(min, maxDelaySec);
  return min + Math.floor(Math.random() * (max - min + 1));
}
