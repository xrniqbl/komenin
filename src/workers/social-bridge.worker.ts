import { createBridgeWorker } from '@/lib/connectors/bridge-worker';
import { createBridgeService } from '@/services/bridge.service';

export class SocialBridgeWorker {
  private service: ReturnType<typeof createBridgeService>;

  constructor() {
    const worker = createBridgeWorker({
      mode: process.env.BRIDGE_MODE === 'live' ? 'live' : 'mock',
      liveUrl: process.env.BRIDGE_LIVE_URL,
      retries: 3,
      timeout: 10000
    });

    this.service = createBridgeService(worker);
  }

  async discoverPosts(
    platform: string,
    query: string,
    limit = 10
  ) {
    return this.service.discoverPosts(platform, query, limit);
  }

  async sendComment(
    platform: string,
    body: string,
    targetPostExternalId: string
  ) {
    return this.service.sendComment(platform, body, targetPostExternalId);
  }

  async publishPost(
    platform: string,
    caption: string,
    mediaUrls: string[] = []
  ) {
    return this.service.publishPost(platform, caption, mediaUrls);
  }

  async healthCheck() {
    return this.service.healthCheck();
  }
}

// Singleton instance
export const bridgeWorker = new SocialBridgeWorker();

// Export methods for easy import. Delegate through the singleton instead of
// destructuring: pulling methods off the instance loses their `this` binding.
export const discoverPosts = (platform: string, query: string, limit = 10) =>
  bridgeWorker.discoverPosts(platform, query, limit);
export const sendComment = (
  platform: string,
  body: string,
  targetPostExternalId: string,
) => bridgeWorker.sendComment(platform, body, targetPostExternalId);
export const publishPost = (platform: string, caption: string, mediaUrls: string[] = []) =>
  bridgeWorker.publishPost(platform, caption, mediaUrls);
export const healthCheck = () => bridgeWorker.healthCheck();