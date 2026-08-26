/**
 * Webhook Signature Verification
 *
 * Provides secure webhook signature validation for all incoming webhooks.
 * Supports multiple signing algorithms and retry-safe comparisons.
 */

import crypto from 'node:crypto';

// ========================================
// SIGNATURE CONFIGURATION
// ========================================

interface WebhookSecretConfig {
  token: string;
  algorithm?: 'sha256' | 'sha384' | 'sha512';
  headerName?: string;
}

const DEFAULT_CONFIG: WebhookSecretConfig = {
  token: process.env.WEBHOOK_SECRET || '',
  algorithm: 'sha256',
  headerName: 'x-webhook-signature',
};

class WebhookVerifier {
  private config: WebhookSecretConfig;
  private versionedTokens: Map<number, string>;

  constructor(config: WebhookSecretConfig = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.versionedTokens = new Map();

    // Initialize with current token
    if (this.config.token) {
      this.versionedTokens.set(1, this.config.token);
    }
  }

  /**
   * Update webhook secret (for rotation)
   */
  updateSecret(newToken: string, version: number = 1): void {
    this.config.token = newToken;
    this.versionedTokens.set(version, newToken);

    console.log(`[WEBHOOK] Secret updated to version ${version}`);
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    options?: { allowMultipleAlgorithms?: boolean }
  ): boolean {
    if (!signature) {
      console.warn('[WEBHOOK VERIFICATION] No signature provided');
      return false;
    }

    // Split signature into parts (timestamp:signatures)
    const parts = signature.split(',');

    // Handle both timestamp format and plain signature
    let timestamp: string | undefined;
    let signatures: string[];

    if (parts[0].includes(':')) {
      // Format: ts=1234567890, sig=abc123...
      const tsPart = parts.find(p => p.startsWith('ts='));
      const sigParts = parts.filter(p => p.startsWith('sig='));

      if (!tsPart || sigParts.length === 0) {
        return false;
      }

      timestamp = tsPart.split('=')[1];
      signatures = sigParts.map(s => s.split('=')[1]);
    } else {
      // Legacy format: just the signature
      signatures = parts;
    }

    // Try each signature (support multiple for rotation)
    for (const sig of signatures) {
      const isValid = this.verifySingleSignature(payload, sig);
      if (isValid) {
        console.log('[WEBHOOK VERIFICATION] Signature verified');
        return true;
      }
    }

    console.warn('[WEBHOOK VERIFICATION] No valid signature found');
    return false;
  }

  /**
   * Verify single signature against payload
   */
  private verifySingleSignature(payload: string, signature: string): boolean {
    try {
      // Create HMAC using configured algorithm
      const hmac = crypto.createHmac(
        this.config.algorithm || 'sha256',
        this.config.token
      );

      hmac.update(payload, 'utf8');
      const expectedSignature = hmac.digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      const isValid = safeEqual(signature, expectedSignature);

      return isValid;
    } catch (error) {
      console.error('[WEBHOOK VERIFICATION] Error computing signature:', error);
      return false;
    }
  }

  /**
   * Generate signature for outgoing webhooks
   */
  generateSignature(payload: string): string {
    const hmac = crypto.createHmac(
      this.config.algorithm || 'sha256',
      this.config.token
    );

    hmac.update(payload, 'utf8');
    const signature = hmac.digest('hex');

    // Add timestamp for replay protection
    const timestamp = Math.floor(Date.now() / 1000);

    return `t=${timestamp},s=${signature}`;
  }

  /**
   * Get verification header name
   */
  getHeaderName(): string {
    return this.config.headerName || 'x-webhook-signature';
  }

  /**
   * Verify webhook timestamp (prevent replay attacks)
   */
  verifyTimestamp(timestamp: string, windowMs: number = 5 * 60 * 1000): boolean {
    const now = Date.now();
    const webhookTime = parseInt(timestamp, 10) * 1000;
    const diff = Math.abs(now - webhookTime);

    return diff <= windowMs;
  }
}

// ========================================
// TIMING-SAFE COMPARISON
// ========================================

function safeEqual(a: string, b: string): boolean {
  const Buffer = require('buffer').Buffer;
  const crypto = require('crypto');

  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');

  // Ensure equal length
  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

// ========================================
// MIDDLEWARE INTEGRATION
// ========================================

interface WebhookRequest extends Request {
  webhookVerified?: boolean;
  webhookPayload?: unknown;
}

// Minimal Node/Express-style shapes for the middleware below
interface NodeLikeRequest {
  on(event: 'data', listener: (chunk: Buffer | string) => void): void;
  on(event: 'end', listener: () => void): void;
  headers: Record<string, string | string[] | undefined>;
}

interface NodeLikeResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body?: string): void;
}

/**
 * Express/Fastify compatible middleware
 */
export function createWebhookMiddleware(verifier: WebhookVerifier) {
  return async (req: NodeLikeRequest, res: NodeLikeResponse, next: () => void): Promise<void> => {
    try {
      // Get payload
      let body = '';
      req.on('data', chunk => {
        body += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });

      req.on('end', () => {
        // Extract signature from headers
        const rawHeader = req.headers[verifier.getHeaderName()];
        const signature = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

        // Verify signature
        if (!signature || !verifier.verifySignature(body, signature)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid or missing signature' }));
          return;
        }

        // Mark request as verified
        (req as unknown as WebhookRequest).webhookVerified = true;
        (req as unknown as WebhookRequest).webhookPayload = JSON.parse(body);

        next();
      });
    } catch (error) {
      console.error('[WEBHOOK MIDDLEWARE] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}

/**
 * Next.js compatible handler wrapper
 */
export async function handleWebhookRequest<T>(
  request: Request,
  handler: (payload: T, signature: string) => Promise<Response>,
  verifier: WebhookVerifier
): Promise<Response> {
  try {
    // Get raw body
    const body = await request.text();
    const signature = request.headers.get(verifier.getHeaderName());

    if (!signature) {
      return Response.json(
        { error: 'Missing signature header' },
        { status: 401 }
      );
    }

    // Verify signature
    if (!verifier.verifySignature(body, signature)) {
      return Response.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    let payload: T;
    try {
      payload = JSON.parse(body) as T;
    } catch {
      return Response.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Call handler
    return await handler(payload, signature);

  } catch (error) {
    console.error('[WEBHOOK HANDLER] Error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ========================================
// EXPORTS
// ========================================

export default WebhookVerifier;

/**
 * Verify an HMAC-SHA256 webhook signature against a payload using an explicit secret.
 *
 * Supports two formats:
 * - Plain hex digest: `<hex>`
 * - Timestamped: `t=<unixSeconds>,s=<hex>` (timestamp freshness is NOT checked here;
 *   use `verifyTimestamp` separately for replay protection)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  options?: { algorithm?: 'sha256' | 'sha384' | 'sha512' }
): boolean {
  if (!signature || !secret) return false;

  const algorithm = options?.algorithm ?? 'sha256';
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payload, 'utf8');
  const expected = hmac.digest('hex');

  // Strip timestamp prefix if present: "t=...,s=<hex>"
  const provided = signature.includes('s=')
    ? signature
        .split(',')
        .map(part => part.trim())
        .filter(part => part.startsWith('s='))
        .map(part => part.slice(2))
    : [signature.trim()];

  return provided.some(sig => safeEqual(sig, expected));
}

// Singleton instance
export const webhookVerifier = new WebhookVerifier();

// For React/Simple HTML responses
export function buildWebhookSignature(payload: object): {
  header: string;
  timestamp: number;
} {
  const timestamp = Math.floor(Date.now() / 1000);
  const jsonString = JSON.stringify(payload);

  const verifier = new WebhookVerifier();
  const sig = verifier.generateSignature(jsonString);

  return {
    header: sig,
    timestamp,
  };
}

// Export types
export type { WebhookSecretConfig };
