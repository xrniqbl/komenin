# Social Bridge Production Checklist

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] `BRIDGE_MODE=real` (or 'live')
- [ ] `BRIDGE_LIVE_URL=https://api.your-social.com/bridge`
- [ ] `BRIDGE_AUTH_TOKEN=your_token`
- [ ] `BRIDGE_API_KEY=your_api_key`
- [ ] `PORT=3001`
- [ ] `RATE_LIMIT=100/15m`
- [ ] `BRIDGE_RETRIES=3`
- [ ] `BRIDGE_TIMEOUT=10000`

### 2. Security
- [ ] Auth headers configured
- [ ] Rate limiting enabled
- [ ] Error masking in production
- [ ] No hardcoded secrets
- [ ] Circuit breaker configured

### 3. Performance
- [ ] Connection pooling enabled
- [ ] Response compression enabled
- [ ] Redis cache configured (if using)
- [ ] Circuit breaker tested

### 4. Monitoring
- [ ] Health endpoint tested
- [ ] Error logging configured
- [ ] Metrics collection enabled
- [ ] Alerting set up

### 5. Testing
- [ ] All unit tests passing
- [ ] E2E tests passing
- [ ] Live mode tested with real API
- [ ] Failover to mock mode tested

### 6. Documentation
- [ ] README updated
- [ ] API docs updated
- [ ] Integrator guide created

## Post-Deployment

- [ ] Monitor bridge health
- [ ] Review logs for errors
- [ ] Test failover scenarios
- [ ] Update monitoring dashboards
- [ ] Document any custom configurations

## Quick Test Commands

```bash
# Test health
curl http://localhost:3001/health

# Test bridge
curl -X POST http://localhost:3001/bridge \
  -H "Content-Type: application/json" \
  -d '{"action": "discoverPosts", "platform": "instagram", "query": "coffee"}'

# Run tests
npm test:mock-bridge
npm test:live-bridge
```