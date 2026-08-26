/**
 * Content Security Policy (CSP) Nonce Manager
 *
 * Provides nonce-based CSP implementation to allow safe inline scripts
 * while maintaining strict security controls.
 */

import crypto from 'node:crypto';

// Store nonces per request
declare global {
  namespace NodeJS {
    interface Global {
      cspNonces?: Map<string, string>;
    }
  }
}

if (!global.cspNonces) {
  global.cspNonces = new Map();
}

const NONCE_HEADER_KEY = 'x-csp-nonce';

/**
 * Generate a new CSP nonce
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Get or create nonce for current request
 */
export function getOrCreateNonce(requestId: string): string {
  let nonces = global.cspNonces!;

  if (!nonces.has(requestId)) {
    nonces.set(requestId, generateNonce());
  }

  return nonces.get(requestId)!;
}

/**
 * Clear all nonces (call after request completes)
 */
export function clearNonces() {
  const nonces = global.cspNonces!;
  nonces.clear();
}

/**
 * Build CSP header with nonce
 */
export function buildCSPPolicy(nonce: string, isProduction: boolean): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    // Allow scripts with nonce
    `script-src 'self' 'nonce-${nonce}'${isProduction ? '' : " 'unsafe-eval'"}`,
    // Styles must include nonce for dynamic styles
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "connect-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  return directives;
}

/**
 * Add nonce to script element in HTML
 */
export function addNonceToScript(html: string, nonce: string): string {
  return html.replace(/<script(?=\s|>|\/)>/gi, `<script nonce="${nonce}"`);
}

/**
 * Middleware to extract nonce from headers
 */
export function getCSPNonceFromRequest(requestId: string): string | null {
  const storedNonce = global.cspNonces?.get(requestId);
  return storedNonce || null;
}

/**
 * For React/Next.js - inject nonce into style tags
 */
export function injectNonceIntoStyles(styles: React.CSSProperties[] = [], nonce: string) {
  return styles.map(style => ({
    ...style,
    key: `${style.key || ''}-${nonce}`, // For emotion/styled-components
  }));
}

/**
 * Create CSP policy for API responses (no nonce needed)
 */
export function buildAPICSP(isProduction: boolean): string {
  const directives = [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");

  return directives;
}

/**
 * Utility to check if CSP should be enforced
 */
export function shouldEnforceCSP(): boolean {
  // Always enforce CSP in production
  if (process.env.NODE_ENV === 'production') return true;

  // Allow opt-out in development via environment variable
  return process.env.DISABLE_CSP !== 'true';
}
