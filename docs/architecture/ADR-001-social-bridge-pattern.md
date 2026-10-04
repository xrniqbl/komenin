# ADR-001: Social Bridge Pattern

## Status

**Accepted** - 2026-08-24

## Context

Komenin perlu mengintegrasikan dengan multiple social media platforms (Instagram, Threads, TikTok) yang masing-masing memiliki:
- API yang berbeda-beda
- Rate limits yang ketat
- OAuth flows yang kompleks
- Potential downtime atau rate limiting issues

Platform juga sering berubah API mereka tanpa notice, sehingga kita butuh fallback mechanism.

## Decision

Menerapkan **Social Bridge Pattern** dengan dua modes:

### 1. Mock Mode (Development/Simulator)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Worker    │ --> │   Bridge     │ --> │  Mock Engine │
│             │     │   Server     │     │  (Fake Data) │
└─────────────┘     └──────────────┘     └──────────────┘
```

**Features:**
- Fake responses untuk development
- No API calls ke real platforms
- Deterministic testing
- Simulasi rate limits & errors

### 2. Live Mode (Production)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Worker    │ --> │   Bridge     │ --> │  Official    │ --> │  Social      │
│             │     │   Client     │     │  Platform    │     │  APIs        │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                        |
                        v
                   ┌──────────────┐
                   │  Fallback    │
                   │  to Mock     │
                   └──────────────┘
```

**Features:**
- Real API calls
- Circuit breaker pattern
- Automatic fallback
- Retry with backoff
- Health monitoring

### 3. Webhook Bridge Pattern (Advanced)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Worker    │ --> │  Webhook     │ --> │  External    │
│             │     │  Publisher   │     │  Service     │
└─────────────┘     └──────────────┘     └──────────────┘
                                                        |
                                                        v
                                                 ┌──────────────┐
                                                 │  Social APIs │
                                                 └──────────────┘
```

Untuk high-volume publishing, menggunakan external webhook service sebagai mediator.

## Rationale

**Why not direct integration?**
1. **Single point of failure**: Jika platform API down, seluruh system down
2. **Rate limit complexity**: Masing-masing platform punya limit berbeda
3. **Security**: API credentials tersebar di banyak tempat
4. **Testing sulit**: Sulit test tanpa real API calls

**Why bridge pattern?**
1. **Abstraction layer**: Semua platform unified interface
2. **Fallback capability**: Bisa switch ke mock saat live failed
3. **Centralized auth**: Token management satu tempat
4. **Observability**: Centralized logging & metrics
5. **Testing**: Easy mock untuk unit/integration tests

## Implementation Details

### Core Interfaces

```typescript
interface SocialBridge {
  discoverPosts(params: DiscoverParams): Promise<Post[]>;
  sendComment(params: CommentParams): Promise<CommentResult>;
  publishPost(params: PublishParams): Promise<PublishResult>;
  healthProbe(): Promise<HealthStatus>;
}

interface BridgeConfig {
  mode: 'mock' | 'live';
  retries?: number;
  timeout?: number;
  circuitBreakerThreshold?: number;
}
```

### Environment Configuration

```bash
# Development
BRIDGE_MODE=mock

# Production
BRIDGE_MODE=live
BRIDGE_LIVE_URL=https://bridge.internal/live
BRIDGE_AUTH_TOKEN=your_secret_token
```

### Error Handling Strategy

1. **Retry Logic**: Exponential backoff (max 3 retries)
2. **Circuit Breaker**: Open after N consecutive failures
3. **Fallback Chain**: Live -> Mock -> Return error
4. **Dead Letter Queue**: Failed requests untuk manual review

## Consequences

### Positive
- ✅ Development dapat berjalan tanpa API credentials
- ✅ Production resilient terhadap API failures
- ✅ Testing deterministik dengan mock mode
- ✅ Centralized observability & logging
- ✅ Easy to add new platforms

### Negative
- ❌ Additional latency dari extra hop
- ❌ Need to maintain bridge infrastructure
- ❌ Debugging lebih complex (2 layers)
- ❌ Cost untuk bridge hosting

### Mitigation
- Use internal network untuk minimize latency
- Automate bridge deployment dengan monitoring
- Structured logging dengan correlation IDs
- Container orchestration untuk cost efficiency

## Related Decisions

- [ADR-002: Worker Task Processing](./ADR-002-worker-processing.md)
- [ADR-003: Session Encryption](./ADR-003-session-encryption.md)
- [ADR-004: Database Schema Design](./ADR-004-database-design.md)

## References

- [PRODUCTION-CHECKLIST.md](../PRODUCTION-CHECKLIST.md)
- [Full Bridge Guide](../integrators/full-guide.md)
- [Live Webhook Bridge Design](../superpowers/specs/2026-07-28-live-webhook-bridge-design.md)
