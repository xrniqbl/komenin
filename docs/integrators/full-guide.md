# Social Bridge - Full Guide

## Complete API Reference

### Bridge Server Endpoints

#### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "mode": "mock" | "live",
  "timestamp": "2026-07-29T12:00:00Z"
}
```

#### Main Bridge Endpoint
```bash
POST /bridge
Content-Type: application/json
```

**Body:**
```json
{
  "action": "discoverPosts" | "sendComment" | "publishPost" | "healthProbe" | "rotateProxy",
  "platform": "instagram" | "threads" | "tiktok",
  "query"?: "coffee",
  "limit"?: 10,
  "body"?: "nice post",
  "targetPostExternalId"?: "post_123",
  "caption"?: "Hello world",
  "mediaUrls"?: ["https://media.com/image1.jpg"],
  "proxyId"?: "px1",
  "seed"?: "abc"
}
```

**Response:**
```json
{
  "ok": true,
  "externalId": "post_123",
  "posts": [
    {
      "externalId": "post_123",
      "authorHandle": "@coffeeholic",
      "content": "Best coffee in town",
      "url": "https://instagram.com/p/abc123",
      "platform": "instagram"
    }
  ],
  "healthy": true,
  "ip": "203.0.113.10"
}
```

## Error Responses

```json
{
  "ok": false,
  "error": "Invalid bridge response: ok=false"
}
```

## Worker Integration

### BridgeWorker

```ts
import { createBridgeWorker } from '@/lib/connectors/bridge-worker';

const worker = createBridgeWorker({
  mode: 'live',
  liveUrl: process.env.BRIDGE_LIVE_URL,
  retries: 3
});
```

### BridgeService

```ts
import { createBridgeService } from '@/services/bridge.service';

const service = createBridgeService(worker);
```

## Production Configuration

### Live Mode

```bash
# .env
BRIDGE_MODE=live
BRIDGE_LIVE_URL=https://api.your-social.com/bridge
BRIDGE_AUTH_TOKEN=your_token
BRIDGE_API_KEY=your_api_key
PORT=3001
RATE_LIMIT=100/15m
```

### Mock Mode

```bash
# .env
BRIDGE_MODE=mock
PORT=3001
RATE_LIMIT=100/15m
```

## Monitoring

### Health Endpoint
- `/health` — Returns mode and status
- `/bridge/raw` — Raw request echo (for testing)

### Metrics
- Request count (rate limited)
- Response time
- Error rate
- Circuit breaker state

## Troubleshooting

### Common Issues

1. **Connection refused**
   - Check `BRIDGE_LIVE_URL`
   - Verify auth token

2. **Rate limited**
   - Reduce request frequency
   - Use caching

3. **Circuit breaker open**
   - Check live service health
   - Reduce retry attempts

4. **Mock mode not working**
   - Verify `BRIDGE_MODE=mock`
   - Check server port

## FAQ

### Q: How do I switch between mock and live?
A: Set `BRIDGE_MODE=mock` or `BRIDGE_MODE=live` in environment variables.

### Q: Can I use Redis for caching?
A: Yes, discoverPosts supports Redis caching when configured.

### Q: How do I add auth headers?
A: Use `BRIDGE_AUTH_TOKEN` and `BRIDGE_API_KEY` environment variables.

### Q: What happens if the live bridge fails?
A: The worker automatically falls back to mock mode.

## Changelog

### v1.0.0
- Initial release
- Mock + Live bridge
- Worker integration
- Security and performance fixes

## Support

For questions or issues, please open an issue in the repository.