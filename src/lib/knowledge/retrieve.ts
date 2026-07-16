export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
}

export function chunkText(text: string, maxChars = 500): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const piece = paragraph.trim();
    if (!piece) continue;
    if ((current + "\n\n" + piece).trim().length > maxChars && current) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  // hard split oversized
  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxChars) return [chunk];
    const parts: string[] = [];
    for (let i = 0; i < chunk.length; i += maxChars) {
      parts.push(chunk.slice(i, i + maxChars));
    }
    return parts;
  });
}

export function rankChunks(
  query: string,
  chunks: Array<{ id: string; content: string }>,
  limit = 3,
): Array<{ id: string; content: string; score: number }> {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) {
    return chunks.slice(0, limit).map((chunk) => ({ ...chunk, score: 0 }));
  }
  return chunks
    .map((chunk) => {
      const tokens = tokenize(chunk.content);
      const overlap = tokens.filter((token) => qTokens.has(token)).length;
      const score = overlap / Math.max(tokens.length, 1);
      return { ...chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((item) => item.score > 0 || chunks.length <= limit);
}
