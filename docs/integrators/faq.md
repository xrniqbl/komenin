# Social Bridge FAQ

## General Questions

### Q: What is Social Bridge?
A: Social Bridge is a unified API layer that abstracts social media platforms (Instagram, Threads, etc.) into a simple interface. It supports both mock mode (for development) and live mode (for production).

### Q: How do I switch between mock and live mode?
A: Set the `BRIDGE_MODE` environment variable:
- `BRIDGE_MODE=mock` (default for development)
- `BRIDGE_MODE=live` (for production)

### Q: What platforms does it support?
A: Currently supports Instagram, Threads, and TikTok through the bridge contract.

### Q: How do I use auth headers in live mode?
A: Use `BRIDGE_AUTH_TOKEN` and `BRIDGE_API_KEY` environment variables. The client will automatically include them in requests.

## Integration

### Q: How do I integrate with my worker?
A: Use the `bridgeWorker` singleton from `@/workers/social-bridge.worker`:

```ts
import { bridgeWorker, discoverPosts, publishPost } from '@/workers/social-bridge.worker';

const posts = await discoverPosts('instagram', 'coffee', 10);
await publishPost('instagram', 'Hello world!', ['media1.jpg']);
```

### Q: Can I use Redis for caching?
A: Yes, discoverPosts supports Redis caching when configured. The cache key includes platform, query, and limit.

### Q: How do I handle rate limiting?
A: The bridge automatically applies rate limiting (100 requests per 15 minutes). Reduce request frequency if needed.

### Q: What happens if the live bridge fails?
A: The worker automatically falls back to mock mode after retries. This provides graceful degradation.

## Security

### Q: Is the bridge secure?
A: Yes, it includes:
- Rate limiting
- Auth header support
- Error masking in production
- Circuit breaker for live mode

### Q: How are secrets handled?
A: All secrets are loaded from environment variables. Never hardcode them in code.

## Performance

### Q: How can I improve performance?
A: Enable:
- Redis caching for discoverPosts
- Response compression (gzip)
- Connection pooling
- Circuit breaker to prevent cascading failures

### Q: Can I batch requests?
A: Yes, the `discoverPosts` method supports batching through the bridge contract.

## Troubleshooting

### Q: Connection refused error
A: Check `BRIDGE_LIVE_URL` and verify the live service is running.

### Q: Rate limited
A: Reduce request frequency or use caching.

### Q: Circuit breaker open
A: Check live service health and reduce retry attempts.

### Q: Mock mode not working
A: Verify `BRIDGE_MODE=mock` and check server port.

## Configuration

### Q: Where do I put environment variables?
A: Create a `.env.local` file and copy from `.env.example`. Never commit secrets to git.

### Q: Can I use different ports for mock and live?
A: Yes, set `PORT` for the server. Mock and live can run on different ports if needed.

### Q: How do I configure different live URLs?
A: Set `BRIDGE_LIVE_URL` to the production endpoint. Use different env files for different environments.

## Support

For questions or issues, please open an issue in the repository or contact the team.

## Changelog

### v1.0.0
- Initial release
- Mock + Live bridge
- Worker integration
- Security and performance fixes

## Related Documentation

- [README.md](README.md)
- [docs/integrators/full-guide.md](docs/integrators/full-guide.md)
- [docs/integrators/checklist.md](docs/integrators/checklist.md)
- [docs/integrators/worker-integration.md](docs/integrators/worker-integration.md)