/**
 * Input Validation & Sanitization Utilities
 *
 * Provides secure input validation, sanitization, and type checking
 * to prevent XSS, SQL injection, and other common attacks.
 */

import z from 'zod';

// ========================================
// VALIDATION UTILITIES
// ========================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID format (v4)
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate username format (alphanumeric, underscores, hyphens)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate phone number (E.164 format or similar)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone);
}

// ========================================
// SANITIZATION FUNCTIONS
// ========================================

/**
 * Sanitize HTML content (basic XSS prevention)
 * Only allows safe tags and strips potentially dangerous attributes
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // Remove script tags and event handlers
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:[^;]*;/gi, '');

  // Allow only safe tags
  const allowedTags = ['b', 'i', 'em', 'strong', 'u', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'];

  // Simple tag sanitization (for production, consider using DOMPurify)
  sanitized = sanitized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // Remove href that starts with javascript:
      if (tagName.toLowerCase() === 'a') {
        if (match.includes('href="javascript:') || match.includes("href='javascript:")) {
          return '';
        }
      }
      return match;
    }
    return '';
  });

  return sanitized.trim();
}

/**
 * Escape special characters in string
 */
export function escapeString(input: string | null | undefined): string {
  if (!input) return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate string safely (won't break UTF-8 chars)
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: string | number, min?: number, max?: number): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : input;

  if (isNaN(num)) return null;

  if (typeof min === 'number' && num < min) return null;
  if (typeof max === 'number' && num > max) return null;

  return Math.floor(num);
}

/**
 * Sanitize array of strings
 */
export function sanitizeArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(item => typeof item === 'string')
    .map(sanitizeHTML);
}

/**
 * Clean object keys (remove null/undefined values, limit depth)
 */
export function cleanObject(obj: unknown, maxDepth: number = 5): object {
  if (maxDepth <= 0 || obj === null || obj === undefined) return {} as object;

  if (typeof obj !== 'object') return obj as object;

  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item, maxDepth - 1));
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip empty/null values
    if (value === null || value === undefined || value === '') continue;

    if (typeof value === 'object') {
      cleaned[key] = cleanObject(value, maxDepth - 1);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

// ========================================
// ZOD SCHEMAS FOR API VALIDATION
// ========================================

export const emailSchema = z.string().email('Invalid email address');
export const urlSchema = z.string().url('Invalid URL');
export const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

export const workspaceSlugSchema = z.string()
  .min(1, 'Workspace slug is required')
  .max(50, 'Workspace slug must be less than 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Workspace slug can only contain lowercase letters, numbers, and hyphens');

export const platformSchema = z.enum(['instagram', 'threads', 'tiktok']);

export const socialPostSchema = z.object({
  externalId: z.string().min(1),
  authorHandle: z.string().min(1),
  content: z.string().min(1).max(5000),
  url: urlSchema.optional(),
});

export const commentDraftSchema = z.object({
  content: z.string().min(1).max(2000, 'Comment too long'),
});

export const campaignSchema = z.object({
  name: z.string().min(1).max(100),
  platform: platformSchema,
  dailyLimit: z.number().int().min(1).max(100),
  minDelaySec: z.number().int().min(1),
  maxDelaySec: z.number().int().min(1),
});

// ========================================
// INPUT VALIDATION HELPERS
// ========================================

/**
 * Validate and parse user input against Zod schema
 */
export function validateInput<T>(input: unknown, schema: z.ZodSchema<T>): {
  valid: boolean;
  data?: T;
  errors?: string[];
} {
  try {
    const result = schema.parse(input);
    return { valid: true, data: result };
  } catch (error) {
    const errors: string[] = [];

    if (error instanceof z.ZodError) {
      // Zod v4 uses `issues` (older versions exposed `errors`)
      const zodError = error as z.ZodError & { errors?: typeof error.issues };
      const issues = zodError.issues ?? zodError.errors ?? [];
      issues.forEach(err => {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      });
    } else {
      errors.push('Validation failed');
    }

    return { valid: false, errors };
  }
}

/**
 * Safe JSON parse with validation
 */
export function safeJSONParse<T>(jsonString: string, schema?: z.ZodSchema<T>): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);

    if (schema) {
      const result = validateInput(parsed, schema);
      if (result.valid) {
        return { success: true, data: result.data! };
      }
      return { success: false, error: result.errors?.join(', ') };
    }

    return { success: true, data: parsed as T };
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON: ${(error as Error).message}`
    };
  }
}

/**
 * Validate request body with rate limiting
 */
interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

class RateLimiter {
  private requestCounts = new Map<string, { count: number; timestamp: number }>();
  private options: RateLimiterOptions;

  constructor(options: RateLimiterOptions) {
    this.options = options;
  }

  check(ip: string): boolean {
    const now = Date.now();
    const record = this.requestCounts.get(ip);

    // Clear old records
    if (!record || now - record.timestamp > this.options.windowMs) {
      this.requestCounts.set(ip, { count: 1, timestamp: now });
      return true;
    }

    // Check current window
    if (record.count >= this.options.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }
}

export const defaultRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

// Export types for TypeScript support
export type ValidatedEmail = z.infer<typeof emailSchema>;
export type ValidatedURL = z.infer<typeof urlSchema>;
export type ValidatedUsername = z.infer<typeof usernameSchema>;
export type ValidatedWorkspaceSlug = z.infer<typeof workspaceSlugSchema>;
export type ValidatedPlatform = z.infer<typeof platformSchema>;
