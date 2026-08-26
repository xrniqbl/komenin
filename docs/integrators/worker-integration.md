# Worker Integration with Social Bridge

## Overview

This guide explains how to integrate the social bridge with your worker and application services.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Worker        │────▶│   BridgeWorker │────▶│   External API  │
│ (Business Logic)│     │   (Mock/Live)   │     │ (Instagram/    │
│                 │     │                 │     │ Threads/etc.)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Setup

### 1. Enable Bridge in Environment

```bash
# .env
BRIDGE_MODE=live  # or 'mock' for development
BRIDGE_LIVE_URL=https://api.your-social-platform.com/bridge
```

### 2. Import and Use

```ts
import { bridgeWorker, discoverPosts, sendComment, publishPost } from '@/workers/social-bridge.worker';

// In worker/service
const posts = await discoverPosts('instagram', 'coffee', 10);

// In business logic
await publishPost('instagram', 'New post!', ['https://media.com/image.jpg']);
```

## Error Handling

The bridge worker automatically handles:
- **Retries** (default: 3 attempts)
- **Timeout** (default: 10s)
- **Mock mode fallback** when live fails
- **Exponential backoff** between retries

## Best Practices

### Use in Services

```ts
// Instead of direct API calls
const posts = await bridgeWorker.discoverPosts('instagram', 'coffee');
```

### Health Monitoring

```ts
const result = await bridgeWorker.healthCheck();
if (!result.ok) {
  // Handle bridge failure
  await handleBridgeDown();
}
```

### Testing

```ts
// Mock mode automatically
const worker = new SocialBridgeWorker();
const result = await worker.publishPost('instagram', 'Test');
expect(result.ok).toBe(true);
```

## Production Checklist

- [ ] Set `BRIDGE_MODE=real` in production
- [ ] Configure `BRIDGE_LIVE_URL`
- [ ] Set up auth headers for live bridge
- [ ] Add circuit breaker for bridge failures
- [ ] Log bridge calls for monitoring
- [ ] Set up alerts for bridge downtime