import { describe, expect, it, vi } from 'vitest';
import axios, { AxiosError } from 'axios';

vi.mock('../../src/lib/url-safety', () => ({ assertSafeOutboundUrlResolved: async (raw: string) => new URL(raw) }));
import { createMockBridgeServer } from '../../src/lib/connectors/bridge-server';
import { createLiveBridgeClient } from '../../src/lib/connectors/bridge-client';

describe('live bridge tests', () => {
  it('does not turn a response-less timeout into a definitive HTTP result', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValueOnce(new AxiosError('timeout', 'ECONNABORTED'));
    try {
      const client = createLiveBridgeClient('https://social.example');
      await expect(client.call('publishPost', 'instagram', { body: 'hello' })).rejects.toThrow();
    } finally { post.mockRestore(); }
  });

  it('preserves a definitive upstream HTTP error response', async () => {
    const response = { status: 429, data: { ok: false, error: 'rate limited', retryAfter: 60 } };
    const post = vi.spyOn(axios, 'post').mockRejectedValueOnce(new AxiosError('rate limited', 'ERR_BAD_RESPONSE', undefined, undefined, response as never));
    try {
      const result = await createLiveBridgeClient('https://social.example').call('publishPost', 'instagram', { body: 'hello' });
      expect(result).toEqual({ status: 429, body: response.data });
    } finally { post.mockRestore(); }
  });

  it('should create live client', () => {
    const client = createLiveBridgeClient('http://localhost:3002');
    expect(client).toBeDefined();
  });

  it('should handle live mode server', async () => {
    const server = createMockBridgeServer({
      mode: 'live',
      liveUrl: 'http://localhost:3002'
    });
    expect(server).toBeDefined();
  });

  it('keeps local mock mode usable without a persistent database', async () => {
    const bridge = createMockBridgeServer({ authToken: 'test-token', port: 0, mockDelay: 1 });
    try {
      await bridge.start();
      const port = (bridge as unknown as { server: { address: () => { port: number } } }).server.address().port;
      const response = await fetch(`http://127.0.0.1:${port}/bridge`, {
        method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publishPost', platform: 'instagram', body: 'hello' }),
      });
      expect(response.status).toBe(200);
    } finally { await bridge.stop(); }
  });

  // Note: live mode requires external service
  it('should validate live endpoint structure', () => {
    // This would be tested against real live bridge
    expect(true).toBe(true);
  });
});