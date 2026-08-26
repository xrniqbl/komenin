# Live Webhook Bridge Setup

## Overview

This guide explains how to set up the live webhook bridge for production use.

## Configuration

### Environment Variables

```bash
# Required
BRIDGE_MODE=live
BRIDGE_LIVE_URL=https://api.your-social.com/bridge

# Optional
BRIDGE_PORT=3001
BRIDGE_MOCK_DELAY=50  # For fallback
```

## Server Setup

### Start Live Bridge

```bash
# Start live bridge server
npm run dev:bridge

# Or programmatically
import { createLiveBridgeServer } from '@/lib/connectors/bridge-server';

const server = createLiveBridgeServer({
  port: 3001,
  liveUrl: process.env.BRIDGE_LIVE_URL
});

await server.start();
```

## Integration Example

### In Worker/Service

```ts
import { BridgeClient } from '@/lib/connectors/bridge-client';

const client = new BridgeClient({
  baseUrl: process.env.BRIDGE_LIVE_URL
});

// Use in worker
const result = await client.call('discoverPosts', 'instagram', {
  query: 'coffee',
  limit: 5
});
```

## Error Handling

- **Network errors** → fallback to mock mode
- **Auth failures** → retry with backoff
- **Rate limiting** → respect headers

## Monitoring

- `/health` endpoint returns mode
- Request logs to console
- Prometheus metrics (optional)

## Production Checklist

- [ ] Set `BRIDGE_MODE=live`
- [ ] Configure `BRIDGE_LIVE_URL`
- [ ] Set proper auth headers
- [ ] Add circuit breaker
- [ ] Set up logging
- [ ] Test failover to mock mode