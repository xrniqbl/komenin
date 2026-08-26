# Mock social bridge

Contract v1 stand-in for Aether live connectors. **Not** the same as
`POST /api/publish/webhook` (in-app delivery log).

## Run

```bash
# from repo root
MOCK_BRIDGE_TOKEN=dev-bridge-token-please-change npm run bridge:mock
```

Listens on `http://127.0.0.1:8787/bridge`.

## Point Aether at it (local)

```env
SIMULATOR_MODE=false
ALLOW_SECURITY_STUBS=true
SOCIAL_PUBLISH_WEBHOOK_URL=http://127.0.0.1:8787/bridge
SOCIAL_PUBLISH_WEBHOOK_TOKEN=dev-bridge-token-please-change
SOCIAL_CONNECTOR_POLICY=prefer_webhook
```

`ALLOW_SECURITY_STUBS=true` is required so `safeOutboundFetch` allows
localhost HTTP outside production.

## Actions

`discoverPosts`, `sendComment`, `publishPost`, `healthProbe`, `rotateProxy`.

See `docs/BRIDGE-CONTRACT.md`.
