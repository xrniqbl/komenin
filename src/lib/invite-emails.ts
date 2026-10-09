/**
 * Shared invite-email parsing for onboarding + API + team flows.
 *
 * Accepts comma/semicolon/whitespace/newline separated pastes (Outlook and
 * spreadsheets commonly produce semicolons), lowercases, dedupes, and caps
 * the batch so a huge paste cannot fire hundreds of sequential invite sends
 * inside a single server action.
 */

export type ParsedInviteEmails = {
  emails: string[];
  /** Entries that looked non-empty but failed the email shape check. */
  skippedInvalid: string[];
  /** Number of extra valid emails dropped by the cap. */
  truncated: number;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_INVITES_PER_BATCH = 50;

export function parseInviteEmails(
  raw: string | null | undefined,
  max = MAX_INVITES_PER_BATCH,
): ParsedInviteEmails {
  const parts = String(raw ?? "").split(/[,;\s]+/);
  const seen = new Set<string>();
  const emails: string[] = [];
  const skippedInvalid: string[] = [];
  let truncated = 0;

  for (const part of parts) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_PATTERN.test(email)) {
      skippedInvalid.push(part.trim());
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    if (emails.length >= max) {
      truncated += 1;
      continue;
    }
    emails.push(email);
  }

  return { emails, skippedInvalid, truncated };
}
