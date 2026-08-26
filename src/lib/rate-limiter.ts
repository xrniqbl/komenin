/**
 * Rate Limiter Utility
 *
 * Provides in-memory rate limiting with support for per-IP and per-user limits.
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
}

interface RateLimitRecord {
  count: number;
  timestamp: number;
}

class RateLimiter {
  private limiters = new Map<string, RateLimitConfig>();
  private tracks = new Map<string, RateLimitRecord>();

  constructor() {
    // Default limiter for general use
    this.limiters.set('default', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      message: 'Too many requests, please try again later.',
    });

    // Strict limiter for authentication endpoints
    this.limiters.set('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      message: 'Too many login attempts, please try again later.',
    });

    // Very strict limiter for webhook endpoints
    this.limiters.set('webhook', {
      windowMs: 60 * 1000,
      maxRequests: 1000,
      message: 'Webhook rate limit exceeded.',
    });

    // API key-based limiter
    this.limiters.set('api-key', {
      windowMs: 60 * 1000,
      maxRequests: 10000,
      message: 'API rate limit exceeded.',
    });
  }

  /**
   * Check if request is within rate limit
   */
  check(key: string, configName: keyof typeof this.limiters = 'default'): {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  } {
    const config = this.limiters.get(configName) || this.limiters.get('default')!;
    const now = Date.now();

    // Get or create record
    let record = this.tracks.get(key);

    // If record doesn't exist or is outside window, create new one
    if (!record || now - record.timestamp > config.windowMs) {
      record = { count: 1, timestamp: now };
      this.tracks.set(key, record);
    } else {
      // Increment counter
      record.count++;

      // Check if exceeded
      if (record.count > config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(record.timestamp + config.windowMs),
        };
      }
    }

    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetAt: new Date(record.timestamp + config.windowMs),
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.tracks.delete(key);
  }

  /**
   * Clear all records (useful for testing or cache warming)
   */
  clear(): void {
    this.tracks.clear();
  }

  /**
   * Get current stats for a key
   */
  getStats(key: string): {
    count: number;
    remaining: number;
    resetAt: Date;
  } | null {
    const record = this.tracks.get(key);
    if (!record) return null;

    const config = Object.values(this.limiters).find(c =>
      Object.values(this.limiters).some(v => v.windowMs === c.windowMs && v.maxRequests === c.maxRequests)
    ) || this.limiters.get('default')!;

    return {
      count: record.count,
      remaining: Math.max(0, config.maxRequests - record.count),
      resetAt: new Date(record.timestamp + config.windowMs),
    };
  }

  /**
   * Add custom rate limiter
   */
  addLimiter(name: string, config: RateLimitConfig): void {
    this.limiters.set(name, config);
  }
}

// Singleton instance
const globalKey = '__aether_rate_limiter_instance';

export function getRateLimiter(): RateLimiter {
  const existing = (global as any)[globalKey];
  if (existing) return existing;

  const limiter = new RateLimiter();
  (global as any)[globalKey] = limiter;

  return limiter;
}

// Pre-create singleton
export const rateLimiter = getRateLimiter();

// Helper functions for common use cases

/**
 * Check auth endpoint rate limit by IP
 */
export function checkAuthRateLimit(ip: string): ReturnType<typeof rateLimiter.check> {
  return rateLimiter.check(`auth:${ip}`, 'auth');
}

/**
 * Check API key rate limit
 */
export function checkAPIKeyRateLimit(apiKeyPrefix: string): ReturnType<typeof rateLimiter.check> {
  return rateLimiter.check(`apikey:${apiKeyPrefix}`, 'api-key');
}

/**
 * Check generic rate limit by IP
 */
export function checkGenericRateLimit(ip: string): ReturnType<typeof rateLimiter.check> {
  return rateLimiter.check(`ip:${ip}`, 'default');
}

export default RateLimiter;
