/**
 * Honest SSO readiness surface for UI + production checks.
 * Signature validation is still not implemented — do not claim production-ready.
 */

export type SsoReadiness = {
  productionAcsEnabled: boolean;
  unsignedDevAllowed: boolean;
  enforceLoginFlag: boolean;
  signatureValidationImplemented: boolean;
  readyForProductionLogin: boolean;
  blockers: string[];
  notes: string[];
};

export function evaluateSsoReadiness(input?: {
  isProduction?: boolean;
  allowSecurityStubs?: boolean;
  enforceLogin?: boolean;
}): SsoReadiness {
  const isProduction =
    input?.isProduction ??
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production");
  const allowSecurityStubs =
    input?.allowSecurityStubs ?? process.env.ALLOW_SECURITY_STUBS === "true";
  const enforceLogin =
    input?.enforceLogin ?? process.env.SSO_ENFORCE_LOGIN === "true";

  // Keep in sync with src/lib/saml/parse.ts assertSamlSignatureValidated.
  const signatureValidationImplemented = false;

  const blockers: string[] = [];
  const notes: string[] = [];

  if (!signatureValidationImplemented) {
    blockers.push("SAML XML signature validation is not implemented.");
  }
  if (isProduction) {
    blockers.push("Production ACS returns 501 until signature validation ships.");
  } else if (!allowSecurityStubs) {
    notes.push("Local unsigned ACS requires ALLOW_SECURITY_STUBS=true.");
  } else {
    notes.push("Dev ACS may accept unsigned SAML when ALLOW_SECURITY_STUBS=true.");
  }
  if (enforceLogin) {
    notes.push("SSO_ENFORCE_LOGIN is set, but Google login is still the primary path.");
  }

  return {
    productionAcsEnabled: false,
    unsignedDevAllowed: !isProduction && allowSecurityStubs,
    enforceLoginFlag: enforceLogin,
    signatureValidationImplemented,
    readyForProductionLogin: false,
    blockers,
    notes,
  };
}
