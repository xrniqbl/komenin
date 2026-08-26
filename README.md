# Social Bridge - Mock + Live

## Overview

Social Bridge is a unified API layer that abstracts social media platforms (Instagram, Threads, etc.) into a simple interface. It supports both **mock mode** (for development) and **live mode** (for production).

## Features

- **Mock Mode**: Full mock implementation with realistic responses
- **Live Mode**: Real API calls to external social platforms
- **Worker Integration**: Easy integration with your worker/services
- **Security**: Rate limiting, auth headers, error masking
- **Performance**: Connection pooling, caching, circuit breaker

## Quick Start

```bash
# Install dependencies
npm install

# Start mock bridge server
npm run dev:bridge

# Start live bridge server
BRIDGE_MODE=live npm run dev:bridge

# Start worker
npm run worker
```

## Environment Variables

```bash
# Bridge Mode
BRIDGE_MODE=mock          # or 'live'
BRIDGE_LIVE_URL=https://api.your-social.com/bridge

# Auth (for live mode)
BRIDGE_AUTH_TOKEN=your_token
BRIDGE_API_KEY=your_api_key

# Server
PORT=3001
RATE_LIMIT=100/15m

# Worker
BRIDGE_RETRIES=3
BRIDGE_TIMEOUT=10000
```

## API Reference

### Bridge Endpoints

```
GET    /health          - Check bridge status
POST   /bridge         - Main bridge endpoint
POST   /bridge/raw     - Raw request for testing
```

### Bridge Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `discoverPosts` | Get posts for a query | `query`, `limit` |
| `sendComment` | Send a comment | `body`, `targetPostExternalId` |
| `publishPost` | Publish a post | `caption`, `mediaUrls[]` |
| `healthProbe` | Check proxy health | - |

## Integration Examples

### Worker/Service

```ts
import { bridgeWorker, discoverPosts, publishPost } from '@/workers/social-bridge.worker';

const posts = await discoverPosts('instagram', 'coffee', 10);
await publishPost('instagram', 'Hello world!', ['media1.jpg']);
```

### Direct Server

```ts
import { createLiveBridgeServer } from '@/lib/connectors/bridge-server';

const server = createLiveBridgeServer({
  port: 3001,
  liveUrl: process.env.BRIDGE_LIVE_URL
});

await server.start();
```

## Security

- **Rate limiting**: 100 requests per 15 minutes
- **Error masking**: Production errors are masked
- **Auth header support**: Supports `Authorization` and `x-api-key`
- **Circuit breaker**: Prevents cascading failures

## Performance

- **Connection pooling**: Axios connection pooling enabled
- **Response compression**: Gzip compression enabled
- **Caching**: Redis cache support for discoverPosts
- **Circuit breaker**: Prevents cascading failures

## Production Checklist

- [ ] Set `BRIDGE_MODE=real`
- [ ] Configure `BRIDGE_LIVE_URL`
- [ ] Set proper auth headers
- [ ] Set up monitoring
- [ ] Test failover to mock mode
- [ ] Review logs for bridge calls

## Testing

```bash
npm test:mock-bridge    # Run all bridge tests
npm test:live-bridge    # Run live mode tests
npm test:watch          # Watch mode
```

## Support

For questions or issues, please open an issue in the repository.