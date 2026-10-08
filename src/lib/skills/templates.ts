// Builtin skill template catalog. Every entry maps 1:1 to an executor path
// that actually exists in src/lib/skills/runtime.ts — do NOT add entries for
// capabilities the runtime cannot execute:
//
// - executor "builtin" + slug "coupon-lookup": runtime reads
//   configJson.codes[] ({ code, detail }) and replies with the first code.
// - executor "builtin" + slug "brand-faq": runtime reads configJson.facts[]
//   (string[]) and answers with the first fact.
// - executor "builtin" + any other slug: generic fallback, no config read.
// - executor "webhook": POSTs { skill, text } to configJson.url with an
//   optional bearer token (configJson.token, sealed to tokenEnc at rest).
//   Response text comes from payload.text | payload.message.
//   Use slug "lead-qualifier" as the conventional slug for webhook skills;
//   the runtime treats all webhook slugs identically.

export type SkillExecutorKind = "builtin" | "webhook";

export type SkillTemplate = {
  key: string;
  name: string;
  slug: string;
  description: string;
  executor: SkillExecutorKind;
  triggers: string[];
  configJson: Record<string, unknown>;
  /** Short operator-facing help shown under the config editor. */
  configHint: string;
};

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    key: "promo-checker",
    name: "Promo Checker",
    slug: "coupon-lookup",
    description: "Lookup active promo codes for engagement replies.",
    executor: "builtin",
    triggers: ["coupon", "diskon", "promo", "kode"],
    configJson: {
      codes: [
        { code: "KOMENIN10", detail: "10% off first month" },
        { code: "GROW20", detail: "20% off annual growth plan" },
      ],
    },
    configHint:
      "codes: array of { code, detail }. The runtime replies with the first entry.",
  },
  {
    key: "faq-responder",
    name: "FAQ Responder",
    slug: "brand-faq",
    description: "Answer common product FAQs from configured facts.",
    executor: "builtin",
    triggers: ["harga", "price", "fitur", "feature", "apa itu"],
    configJson: {
      facts: [
        "Komenin is an enterprise social operations control plane.",
        "Default campaign mode requires human approval.",
        "Hybrid connectors support simulator, webhook, and official APIs.",
      ],
    },
    configHint:
      "facts: array of strings. The runtime answers with the first entry.",
  },
  {
    key: "lead-qualifier",
    name: "Lead Qualifier (webhook)",
    slug: "lead-qualifier",
    description: "Forward high-intent messages to your webhook for qualification.",
    executor: "webhook",
    triggers: ["tertarik", "minat", "order", "beli", "demo"],
    configJson: {
      url: "https://example.com/hooks/lead-qualifier",
      method: "POST",
      timeoutMs: 8000,
      token: "",
    },
    configHint:
      "url (required): HTTPS endpoint receiving POST { skill, text }. token (optional): bearer token, encrypted at rest. method/timeoutMs are informational — the runtime always POSTs with a built-in timeout.",
  },
];

export function getSkillTemplate(key: string): SkillTemplate | undefined {
  return SKILL_TEMPLATES.find((t) => t.key === key);
}

/** Field help for the executor config editor, keyed by executor. */
export const EXECUTOR_CONFIG_HELP: Record<SkillExecutorKind, string> = {
  builtin:
    "Builtin skills read skill-specific fields: coupon-lookup uses codes[] ({ code, detail }), brand-faq uses facts[] (strings). Any other builtin slug runs the generic fallback and ignores configJson.",
  webhook:
    "Webhook skills POST { skill, text } to url and read the reply from payload.text | payload.message. Supported fields: url (required, public HTTPS only), token (optional bearer token, encrypted at rest — shown as hasToken after save). method/timeoutMs are informational.",
};
