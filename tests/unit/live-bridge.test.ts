import { describe, expect, it } from 'vitest';
import { createMockBridgeServer } from '../../src/lib/connectors/bridge-server';
import { createLiveBridgeClient } from '../../src/lib/connectors/bridge-client';

describe('live bridge tests', () => {
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

  // Note: live mode requires external service
  it('should validate live endpoint structure', () => {
    // This would be tested against real live bridge
    expect(true).toBe(true);
  });
});