/**
 * Integration Tests for New Utilities
 *
 * Tests for security middleware, validation, rate limiting, and other improvements.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isValidEmail,
  isValidURL,
  sanitizeHTML,
  validateInput,
  emailSchema
} from '@/lib/validation';
import {
  generateNonce,
  buildCSPPolicy,
  shouldEnforceCSP
} from '@/lib/csp-nonce';
import { consumeRateLimitMemory } from '@/lib/rate-limit';
import { verifyWebhookSignature } from '@/lib/webhook-verifier';
import {
  successResponse,
  errorResponse,
  handlePromise,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  APIError
} from '@/lib/api-response';
import { metrics } from '@/lib/metrics';
import { z } from 'zod';
import crypto from 'node:crypto';

describe('Integration: Security & Validation', () => {
  beforeEach(() => {
    // Mock console.warn for cleaner output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('Input Validation', () => {
    it('validates email addresses correctly', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });

    it('validates URLs correctly', () => {
      expect(isValidURL('https://example.com')).toBe(true);
      expect(isValidURL('http://localhost:3000')).toBe(true);
      expect(isValidURL('not-a-url')).toBe(false);
      expect(isValidURL('ftp://ftp.example.com')).toBe(true);
    });

    it('sanitizes HTML to prevent XSS', () => {
      const malicious = '<script>alert("XSS")</script><p>Safe content</p>';
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Safe content');
    });

    it('sanitizes event handlers in HTML', () => {
      const malicious = '<img src="x" onerror="alert(1)"><p>safe text</p>';
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain('onerror');
      // img is not in the allowed tag list, so it is stripped entirely
      expect(sanitized).not.toContain('<img');
      expect(sanitized).toContain('safe text');
    });
  });

  describe('CSP Nonce Generation', () => {
    it('generates valid base64 nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      // Should be different each time
      expect(nonce1).not.toBe(nonce2);

      // Should be valid base64 format (16 bytes → 24 chars, padding included)
      expect(nonce1.length).toBeGreaterThan(0);
      expect(/^[A-Za-z0-9+/]+={0,2}$/.test(nonce1)).toBe(true);
    });

    it('builds CSP policy with nonce', () => {
      const nonce = generateNonce();
      const isProd = true;

      const policy = buildCSPPolicy(nonce, isProd);

      expect(policy).toContain(`'nonce-${nonce}'`);
      expect(policy).toContain('default-src');
      expect(policy).toContain('upgrade-insecure-requests');
    });

    it('allows unsafe-eval in development mode', () => {
      const nonce = generateNonce();
      const isProd = false;

      const policy = buildCSPPolicy(nonce, isProd);

      // Development allows eval for debugging
      expect(policy).toContain('unsafe-eval');
    });

    it('should enforce CSP based on environment', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(shouldEnforceCSP()).toBe(true);

      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('DISABLE_CSP', '');
      expect(shouldEnforceCSP()).toBe(true);

      vi.stubEnv('DISABLE_CSP', 'true');
      expect(shouldEnforceCSP()).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('allows requests within limit', () => {
      const key = `test:allow:${Math.random()}`;
      const result1 = consumeRateLimitMemory({ key, limit: 5, windowMs: 60_000 });
      expect(result1.ok).toBe(true);
      expect(result1.remaining).toBeGreaterThanOrEqual(0);
    });

    it('blocks requests exceeding limit', () => {
      const key = `test:block:${Math.random()}`;
      for (let i = 0; i < 5; i++) {
        consumeRateLimitMemory({ key, limit: 5, windowMs: 60_000 });
      }
      const result = consumeRateLimitMemory({ key, limit: 5, windowMs: 60_000 });
      expect(result.ok).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('tracks separate limits per key', () => {
      const key1 = `test:sep1:${Math.random()}`;
      const key2 = `test:sep2:${Math.random()}`;

      consumeRateLimitMemory({ key: key1, limit: 5, windowMs: 60_000 });
      consumeRateLimitMemory({ key: key2, limit: 5, windowMs: 60_000 });

      const result1 = consumeRateLimitMemory({ key: key1, limit: 5, windowMs: 60_000 });
      const result2 = consumeRateLimitMemory({ key: key2, limit: 5, windowMs: 60_000 });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      expect(result1.remaining).toBe(result2.remaining);
    });
  });

  describe('Webhook Verification', () => {
    it('verifies correct signature', () => {
      const payload = JSON.stringify({ type: 'test', data: 'important' });
      const secret = 'test-webhook-secret-key';

      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const isValid = verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('rejects invalid signature', () => {
      const payload = '{"type":"test"}';
      const secret = 'correct-secret';
      const invalidSignature = 'wrong-signature';

      const isValid = verifyWebhookSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    it('handles missing signature gracefully', () => {
      const payload = '{}';

      const isValid = verifyWebhookSignature(payload, '', '');
      expect(isValid).toBe(false);
    });

    it('supports timestamp-based signatures', () => {
      const payload = '{"data":"value"}';
      const secret = 'my-secret';
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const formattedSignature = `t=${timestamp},s=${signature}`;
      const isValid = verifyWebhookSignature(payload, formattedSignature, secret);
      expect(isValid).toBe(true);
    });
  });

  describe('API Response Helpers', () => {
    it('creates success responses correctly', () => {
      const data = { id: '1', name: 'Test' };
      const response = successResponse(data, 'Operation successful');

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('creates error responses with proper status codes', async () => {
      const response = errorResponse(new BadRequestError('Invalid input'));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid input');
      expect(body.code).toBe('BAD_REQUEST');
    });

    it('handles promises with success handler', async () => {
      const mockData = { result: 'success' };

      const result = await handlePromise(
        Promise.resolve(mockData),
        data => successResponse(data),
        error => errorResponse(new InternalServerError(error.message))
      );

      expect(result.status).toBe(200);
    });

    it('handles promise rejections with error handler', async () => {
      const mockError = new Error('Test error');

      const result = await handlePromise(
        Promise.reject(mockError),
        data => successResponse(data),
        error => errorResponse(new InternalServerError(error.message))
      );

      expect(result.status).toBe(500);
    });

    it('handles custom errors appropriately', async () => {
      const notFoundError = new NotFoundError('Resource not found');

      const result = await handlePromise(
        Promise.reject(notFoundError),
        data => successResponse(data),
        error => errorResponse(error as APIError)
      );

      expect(result.status).toBe(404);
      const body = await result.json();
      expect(body.error).toBe('Resource not found');
    });
  });

  describe('Metrics Collection', () => {
    it('records request metrics correctly', () => {
      const endpoint = '/api/test';
      const method = 'POST';
      const statusCode = 200;
      const latency = 45;

      metrics.recordRequest({ endpoint, method, statusCode, latencyMs: latency });

      // Metrics are logged internally - just verify no errors
      expect(() => {
        metrics.recordRequest({ endpoint, method, statusCode, latencyMs: latency });
      }).not.toThrow();
    });

    it('tracks job completion', () => {
      metrics.recordJob('health-check', 'success', 1200);
      expect(() => {
        metrics.recordJob('health-check', 'success', 1200);
      }).not.toThrow();
    });

    it('tracks job failures', () => {
      metrics.recordJob('critical-task', 'failed', 5000, 'connection_timeout');
      expect(() => {
        metrics.recordJob('critical-task', 'failed', 5000, 'connection_timeout');
      }).not.toThrow();
    });
  });

  describe('End-to-End Validation Flow', () => {
    it('validates complete user registration flow', async () => {
      const requestBody = {
        email: 'user@example.com',
        username: 'john_doe',
        password: 'StrongPassword123!',
        name: 'John Doe',
      };

      const validation = validateInput(requestBody, z.object({
        email: emailSchema,
        username: z.string().min(3).max(30),
        password: z.string().min(8).max(100),
        name: z.string().optional(),
      }));

      expect(validation.valid).toBe(true);

      const rateKey = `register:${Math.random()}`;
      const rateResult = consumeRateLimitMemory({ key: rateKey, limit: 5, windowMs: 60_000 });
      expect(rateResult.ok).toBe(true);

      const safeName = sanitizeHTML(requestBody.name!);
      expect(safeName).toBe('John Doe');
    });

    it('handles invalid input gracefully', async () => {
      const requestBody = {
        email: 'invalid-email',
        username: 'ab', // Too short
        password: 'weak', // Too short
      };

      const validation = validateInput(requestBody, z.object({
        email: emailSchema,
        username: z.string().min(3).max(30),
        password: z.string().min(8).max(100),
      }));

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases & Boundary Conditions', () => {
    it('handles empty payloads', () => {
      const result = validateInput({}, z.object({ email: z.string().email() }));
      expect(result.valid).toBe(false);
    });

    it('handles null/undefined values', () => {
      expect(sanitizeHTML(null as any)).toBe('');
      expect(sanitizeHTML(undefined as any)).toBe('');
    });

    it('handles very long inputs gracefully', () => {
      const longString = 'a'.repeat(10000);
      const sanitized = sanitizeHTML(longString);
      expect(typeof sanitized).toBe('string');
    });

    it('rate limit respects time windows', () => {
      const key = `test:window:${Math.random()}`;

      for (let i = 0; i < 3; i++) {
        consumeRateLimitMemory({ key, limit: 5, windowMs: 60_000 });
      }

      const result = consumeRateLimitMemory({ key, limit: 5, windowMs: 60_000 });

      expect(result.resetAt).toBeGreaterThan(Date.now());
    });
  });
});
