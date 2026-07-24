const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "have",
  "are",
  "was",
  "were",
  "you",
  "our",
  "not",
  "but",
  "all",
  "any",
  "can",
  "will",
  "just",
  "ada",
  "yang",
  "dan",
  "untuk",
  "dari",
  "dengan",
  "ini",
  "itu",
  "kami",
  "kita",
  "anda",
  "tidak",
  "bisa",
  "juga",
  "sudah",
  "lebih",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9À-ɏ]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !STOPWORDS.has(part));
}

/** Unigrams + adjacent bigrams for slightly richer lexical matching. */
export function expandTerms(tokens: string[]): string[] {
  const terms = [...tokens];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    terms.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return terms;
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

function termFrequency(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const term of terms) {
    tf.set(term, (tf.get(term) || 0) + 1);
  }
  return tf;
}

/**
 * Hybrid lexical ranker: TF-IDF-ish unigram/bigram overlap with soft length norm.
 * Still embedding-free (works offline) but more relevant than raw token ratio.
 * When FEATURE knowledge_embeddings is later enabled, callers can blend vectors.
 */
export function rankChunks(
  query: string,
  chunks: Array<{ id: string; content: string }>,
  limit = 3,
): Array<{ id: string; content: string; score: number }> {
  const qTerms = expandTerms(tokenize(query));
  const qSet = new Set(qTerms);
  if (qSet.size === 0) {
    return chunks.slice(0, limit).map((chunk) => ({ ...chunk, score: 0 }));
  }

  const docTerms = chunks.map((chunk) => expandTerms(tokenize(chunk.content)));
  const df = new Map<string, number>();
  for (const terms of docTerms) {
    const unique = new Set(terms);
    for (const term of unique) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  const n = Math.max(chunks.length, 1);
  return chunks
    .map((chunk, index) => {
      const terms = docTerms[index] || [];
      const tf = termFrequency(terms);
      let score = 0;
      for (const term of qSet) {
        const f = tf.get(term) || 0;
        if (!f) continue;
        const idf = Math.log(1 + n / (1 + (df.get(term) || 0)));
        // bigrams weigh slightly higher
        const weight = term.includes("_") ? 1.35 : 1;
        score += (1 + Math.log(f)) * idf * weight;
      }
      // Mild density preference without punishing long useful chunks too hard.
      const density = score / Math.sqrt(Math.max(terms.length, 1));
      return { ...chunk, score: Math.round(density * 1000) / 1000 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((item) => item.score > 0 || chunks.length <= limit);
}
