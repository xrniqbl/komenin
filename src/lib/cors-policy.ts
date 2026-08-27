/**
 * CORS Policy Configuration
 *
 * Defines allowed origins for cross-origin requests.
 * This ensures only trusted domains can interact with your API.
 */

// List of allowed origins
// In production, add your actual domain(s) here
const ALLOWED_ORIGINS = [
  'https://komenin.id',
  'https://app.komenin.id',
  'http://localhost:3000', // Development only
  'http://localhost:3001', // Bridge server dev
];

/**
 * Check if an origin is allowed
 */
export function isValidOrigin(origin: string): boolean {
  if (!origin) return true; // Allow requests without origin (server-to-server)

  const normalizedOrigin = origin.toLowerCase();
  return ALLOWED_ORIGINS.some(allowed => allowed === normalizedOrigin);
}

/**
 * Get Access-Control-Allow-Origin header value
 */
export function getCORSOriginHeader(origin: string): string | '*' {
  if (isValidOrigin(origin)) {
    return origin;
  }

  // Return empty string to block unauthorized origins
  return '';
}

/**
 * Create CORS headers object
 */
export function createCORSHeaders(origin: string): HeadersInit {
  const allowedOrigin = getCORSOriginHeader(origin);

  return {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-request-id',
    'Access-Control-Max-Age': '86400', // 24 hours for preflight caching
    'Vary': 'Origin',
  };
}

/**
 * Handle preflight OPTIONS request
 */
export function handlePreflightRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: createCORSHeaders('*'),
  });
}

/**
 * Validate and sanitize origin before use
 */
export function validateOrigin(origin: string | null): boolean {
  if (!origin) return true;

  try {
    const parsedUrl = new URL(origin);
    const protocol = parsedUrl.protocol.toLowerCase();

    // Only allow http and https protocols
    if (protocol !== 'http:' && protocol !== 'https:') {
      console.warn(`[CORS] Invalid protocol: ${protocol}`);
      return false;
    }

    return isValidOrigin(parsedUrl.origin);
  } catch {
    console.warn(`[CORS] Invalid origin format: ${origin}`);
    return false;
  }
}
