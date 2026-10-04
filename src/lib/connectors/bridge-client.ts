import axios from 'axios';
import { assertSafeOutboundUrlResolved } from '../url-safety';
import type { BridgeAction } from './bridge-contract';
export type { BridgeAction } from './bridge-contract';

export type BridgeClientConfig = {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
};

export class BridgeClient {
  private config: BridgeClientConfig;

  constructor(config: BridgeClientConfig = {}) {
    const token = process.env.BRIDGE_AUTH_TOKEN?.trim();
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...config.headers,
    };
    this.config = {
      timeout: 10000,
      ...config,
      headers
    };
  }

  async call(
    action: BridgeAction,
    platform: string,
    body: any,
    idempotencyKey?: string | null
  ) {
    if (!this.config.baseUrl) {
      // Fail closed with a clear error instead of building the URL
      // `"undefined/bridge"` and letting axios reject with a confusing message.
      return {
        status: 500,
        body: {
          ok: false,
          error: 'BridgeClient baseUrl is not configured',
        },
      };
    }
    // SSRF guard: liveUrl is operator-configured (BRIDGE_LIVE_URL). Validate
    // the URL shape AND its resolved DNS (private/metadata targets rejected),
    // and refuse redirects at request time so a compromised bridge cannot
    // bounce the app's bearer token elsewhere.
    let validatedBase: string;
    try {
      validatedBase = (await assertSafeOutboundUrlResolved(this.config.baseUrl)).toString().replace(/\/$/, "");
    } catch {
      return {
        status: 500,
        body: {
          ok: false,
          error: 'BridgeClient baseUrl is not allowed',
        },
      };
    }
    const url = `${validatedBase}/bridge`;

    try {
      const response = await axios.post(url, {
        action,
        platform,
        ...body,
        timestamp: Date.now()
      }, {
        timeout: this.config.timeout,
        maxRedirects: 0,
        headers: {
          ...this.config.headers,
          ...(idempotencyKey ? { 'x-komenin-idempotency-key': idempotencyKey } : {})
        }
      });

      return {
        status: response.status,
        body: response.data
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: error.response?.status || 500,
          body: {
            ok: false,
            error: error.response?.data?.error || error.message
          }
        };
      }
      return {
        status: 500,
        body: {
          ok: false,
          error: 'Unknown error'
        }
      };
    }
  }

  static async discoverPosts(
    platform: string,
    query: string,
    limit = 10
  ) {
    const client = new BridgeClient();
    return client.call('discoverPosts', platform, { query, limit });
  }

  static async sendComment(
    platform: string,
    body: string,
    targetPostExternalId: string
  ) {
    const client = new BridgeClient();
    return client.call('sendComment', platform, { body, targetPostExternalId });
  }

  static async publishPost(
    platform: string,
    caption: string,
    mediaUrls: string[] = []
  ) {
    const client = new BridgeClient();
    return client.call('publishPost', platform, { caption, mediaUrls });
  }
}

// Factory
export const createLiveBridgeClient = (baseUrl: string) => {
  return new BridgeClient({ baseUrl });
};