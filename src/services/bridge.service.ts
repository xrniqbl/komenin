import { BridgeWorker } from '@/lib/connectors/bridge-worker';

export class BridgeService {
  private worker: BridgeWorker;

  constructor(worker: BridgeWorker) {
    this.worker = worker;
  }

  async discoverPosts(
    platform: string,
    query: string,
    limit = 10
  ) {
    return this.worker.discoverPosts(platform, query, limit);
  }

  async sendComment(
    platform: string,
    body: string,
    targetPostExternalId: string
  ) {
    return this.worker.sendComment(platform, body, targetPostExternalId);
  }

  async publishPost(
    platform: string,
    caption: string,
    mediaUrls: string[] = []
  ) {
    return this.worker.publishPost(platform, caption, mediaUrls);
  }

  async healthCheck() {
    return this.worker.healthProbe();
  }

  // High-level convenience methods
  async getRecentPosts(
    platform: string,
    query: string,
    limit = 5
  ) {
    return this.discoverPosts(platform, query, limit);
  }

  async createPost(
    platform: string,
    content: string,
    mediaUrls: string[] = []
  ) {
    return this.publishPost(platform, content, mediaUrls);
  }

  async replyToPost(
    platform: string,
    body: string,
    postExternalId: string
  ) {
    return this.sendComment(platform, body, postExternalId);
  }
}

// Factory
export const createBridgeService = (worker: BridgeWorker) => {
  return new BridgeService(worker);
};