/**
 * Minimal SAMLResponse helpers.
 * This is NOT a full SAML library — signature validation is required before production.
 */

export type ParsedSamlAssertion = {
  email: string | null;
  name: string | null;
  nameId: string | null;
  issuer: string | null;
  audience: string | null;
  notOnOrAfter: string | null;
  rawXml: string;
};

function decodeSamlResponse(raw: string): string {
  const trimmed = raw.trim();
  // Some IdPs send URL-encoded or whitespace-wrapped base64.
  const normalized = trimmed.replace(/\s+/g, "");
  try {
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return trimmed;
  }
}

function firstTagText(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
    "i",
  );
  const m = xml.match(re);
  if (!m?.[1]) return null;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() || null;
}

function firstAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${tag}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const m = xml.match(re);
  return m?.[1]?.trim() || null;
}

function extractEmailFromAttributes(xml: string): string | null {
  // Common AttributeStatement patterns
  const attrBlocks = xml.match(
    /<(?:[\w-]+:)?Attribute\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?Attribute>/gi,
  );
  if (!attrBlocks) return null;
  for (const block of attrBlocks) {
    const name = firstAttr(block, "Attribute", "Name") || firstAttr(block, "Attribute", "FriendlyName") || "";
    const value = firstTagText(block, "AttributeValue");
    if (!value) continue;
    if (/email|mail|nameidentifier/i.test(name) && value.includes("@")) return value.toLowerCase();
    if (value.includes("@") && value.includes(".")) return value.toLowerCase();
  }
  return null;
}

export function parseSamlResponse(rawSamlResponse: string): ParsedSamlAssertion {
  const rawXml = decodeSamlResponse(rawSamlResponse);
  const nameId = firstTagText(rawXml, "NameID");
  const issuer = firstTagText(rawXml, "Issuer");
  const audience = firstTagText(rawXml, "Audience");
  const notOnOrAfter =
    firstAttr(rawXml, "Conditions", "NotOnOrAfter") ||
    firstAttr(rawXml, "SubjectConfirmationData", "NotOnOrAfter");
  const displayName =
    firstTagText(rawXml, "AttributeValue") &&
    // prefer explicit name attributes when present
    (() => {
      const blocks = rawXml.match(
        /<(?:[\w-]+:)?Attribute\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?Attribute>/gi,
      );
      if (!blocks) return null;
      for (const block of blocks) {
        const name = firstAttr(block, "Attribute", "Name") || "";
        if (/displayname|cn|name$/i.test(name)) return firstTagText(block, "AttributeValue");
      }
      return null;
    })();

  let email = extractEmailFromAttributes(rawXml);
  if (!email && nameId?.includes("@")) email = nameId.toLowerCase();

  return {
    email,
    name: displayName,
    nameId,
    issuer,
    audience,
    notOnOrAfter,
    rawXml,
  };
}

/**
 * Production gate for SAML signature validation.
 * Returns an error message when signature validation is unavailable.
 * Replace body with real XMLDSig verification against ssoConfig.certificate.
 */
export function assertSamlSignatureValidated(_input: {
  xml: string;
  certificatePem: string;
}): { ok: true } | { ok: false; reason: string } {
  // Intentionally not implemented: do not accept unsigned assertions in production.
  if (process.env.SAML_ALLOW_UNSIGNED === "true" && process.env.NODE_ENV !== "production") {
    return { ok: true };
  }
  return {
    ok: false,
    reason:
      "SAML XML signature validation is not implemented. Configure a real XMLDSig verifier before enabling SSO ACS.",
  };
}

export function isAssertionTimeValid(notOnOrAfter: string | null, now = new Date()): boolean {
  if (!notOnOrAfter) return true; // absence checked by caller policy if needed
  const exp = Date.parse(notOnOrAfter);
  if (Number.isNaN(exp)) return false;
  return exp > now.getTime();
}
