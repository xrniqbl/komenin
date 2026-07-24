import { z } from "zod";

export const contactPayloadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid work email required").max(200),
  message: z.string().trim().min(10, "Message is too short").max(5000),
  /**
   * Honeypot — humans leave empty; bots often fill it.
   * Accepted by the schema so the API can silently ignore spam.
   */
  company: z.string().max(200).optional().default(""),
});

export type ContactPayload = z.infer<typeof contactPayloadSchema>;

export type ContactSubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number };

export function salesInbox(): string | null {
  const raw = process.env.SALES_INBOX_EMAIL?.trim() || process.env.CONTACT_TO_EMAIL?.trim();
  return raw || null;
}

export function contactWebhookUrl(): string | null {
  const raw = process.env.CONTACT_WEBHOOK_URL?.trim();
  return raw || null;
}
