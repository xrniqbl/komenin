/**
 * Content Security Policy (CSP) Nonce Manager
 *
 * Provides nonce-based CSP implementation to allow safe inline scripts
 * while maintaining strict security controls.
 */

import crypto from 'node:crypto';
import type { CSSProperties } from 'react';

// Store nonces per request (global to survive module reloads in dev)
const globalStore = globalThis as unknown as {
  cspNonces?: Map<string, string>;
};

if (!globalStore.cspNonces) {
  globalStore.cspNonces = new Map();
}

const nonceStore = globalStore.cspNonces;

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
  if (!nonceStore.has(requestId)) {
    nonceStore.set(requestId, generateNonce());
  }

  return nonceStore.get(requestId)!;
}

/**
 * Clear all nonces (call after request completes)
 */
export function clearNonces() {
  nonceStore.clear();
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
 * Look up the nonce previously issued for a request id
 */
export function getCSPNonceFromRequest(requestId: string): string | null {
  return nonceStore.get(requestId) || null;
}

/**
 * For React/Next.js - inject nonce into style keys
 */
export function injectNonceIntoStyles(styles: CSSProperties[] = [], nonce: string) {
  return styles.map(style => ({
    ...style,
    // React style objects don't carry keys; cast for emotion/styled-components consumers
    key: `${String((style as Record<string, unknown>).key || '')}-${nonce}`,
  }));
}

/**
 * Create CSP policy for API responses (no nonce needed)
 */
export function buildAPICSP(_isProduction: boolean): string {
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
