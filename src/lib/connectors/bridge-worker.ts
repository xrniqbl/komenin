import { BridgeClient } from './bridge-client';
import { handleMockBridgeRequest, type BridgeAction } from './bridge-contract';

export type BridgeWorkerConfig = {
  mode?: 'mock' | 'live';
  liveUrl?: string;
  mockDelay?: number;
  retries?: number;
  timeout?: number;
};

export class BridgeWorker {
  private config: BridgeWorkerConfig;
  private client: BridgeClient;

  constructor(config: BridgeWorkerConfig = {}) {
    this.config = {
      mode: 'mock',
      retries: 3,
      timeout: 10000,
      ...config
    };

    this.client = new BridgeClient({
      baseUrl: this.config.liveUrl,
      timeout: this.config.timeout
    });
  }

  async discoverPosts(
    platform: string,
    query: string,
    limit = 10
  ) {
    return this.execute('discoverPosts', { platform, query, limit });
  }

  async sendComment(
    platform: string,
    body: string,
    targetPostExternalId: string,
    idempotencyKey?: string
  ) {
    return this.execute('sendComment', { platform, body, targetPostExternalId }, idempotencyKey);
  }

  async publishPost(
    platform: string,
    caption: string,
    mediaUrls: string[] = [],
    idempotencyKey?: string
  ) {
    return this.execute('publishPost', { platform, caption, mediaUrls }, idempotencyKey);
  }

  async healthProbe() {
    return this.execute('healthProbe', { platform: 'instagram' });
  }

  private async execute(
    action: BridgeAction,
    payload: Record<string, unknown>,
    idempotencyKey?: string
  ) {
    let lastError: Error | null = null;
    // Mutations have no safe blind retry — but they DO carry an idempotency
    // key, so transport failures may be retried only when one was supplied;
    // otherwise retrying an ok=false business failure could duplicate posts.
    const retryBusinessFailure = action === 'discoverPosts' || action === 'healthProbe';

    for (let attempt = 0; attempt < this.config.retries!; attempt++) {
      try {
        const result = await this.callBridge(action, payload, idempotencyKey);

        if (result.ok) {
          return {
            ok: true,
            ...result
          };
        }

        lastError = new Error(result.error || 'Bridge returned ok=false');
        if (!retryBusinessFailure) break;
        await this.delay(attempt * 200);

      } catch (error) {
        lastError = error as Error;
        // M14: a transport failure (timeout/lost response) after the bridge
        // accepted a mutation can mean the post already exists. Only retry
        // mutations when an idempotency key lets the bridge dedup; reads are
        // always safe to retry.
        if (!retryBusinessFailure && !idempotencyKey) break;
        await this.delay(attempt * 200);
      }
    }

    throw lastError || new Error('Bridge execution failed after retries');
  }

  private async callBridge(action: BridgeAction, payload: Record<string, unknown>, idempotencyKey?: string) {
    if (this.config.mode === 'mock') {
      // Delegate to the shared contract handler so mock responses match the
      // real bridge shape (e.g. discoverPosts returns a posts array, healthProbe
      // returns healthy). Previously this returned a hardcoded shape that omitted
      // `posts` and created an unused Express server on every call.
      const res = handleMockBridgeRequest({ action, ...payload });
      const body = res.body as Record<string, unknown>;
      return {
        ok: res.status >= 200 && res.status < 300 && body.ok !== false,
        ...body,
      };
    }

    // Live mode
    const result = await this.client.call(action, (typeof payload.platform === 'string' && payload.platform) || 'unknown', payload, idempotencyKey);
    return {
      ok: result.status === 200,
      ...result.body
    };
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory
export const createBridgeWorker = (config: BridgeWorkerConfig = {}) => {
  return new BridgeWorker(config);
};