import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rows, state, create, findUnique, updateMany, call } = vi.hoisted(() => {
  type Row = { key: string; payloadHash: string; status: string; httpStatus: number | null; response: unknown; expiresAt: Date };
  const rows = new Map<string, Row>();
  const state = { databaseFailure: false };
  const create = vi.fn(async ({ data }: { data: Row }) => {
    if (state.databaseFailure) throw new Error('database unavailable');
    if (rows.has(data.key)) throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
    rows.set(data.key, { ...data });
    return data;
  });
  const findUnique = vi.fn(async ({ where }: { where: { key: string } }) => {
    if (state.databaseFailure) throw new Error('database unavailable');
    return rows.get(where.key) ?? null;
  });
  const updateMany = vi.fn(async ({ where, data }: { where: { key: string; status: string; payloadHash: string }; data: { status: string; httpStatus: number; response: unknown } }) => {
    if (state.databaseFailure) throw new Error('database unavailable');
    const row = rows.get(where.key);
    if (!row || row.status !== where.status || row.payloadHash !== where.payloadHash) return { count: 0 };
    rows.set(where.key, { ...row, ...data });
    return { count: 1 };
  });
  const call = vi.fn(async () => ({ status: 200, body: { ok: true, externalId: `external-${call.mock.calls.length}` } }));
  return { rows, state, create, findUnique, updateMany, call };
});
vi.mock('../../src/lib/db', () => ({ db: { bridgeIdempotency: { create, findUnique, updateMany } } }));
vi.mock('../../src/lib/connectors/bridge-client', () => ({ createLiveBridgeClient: () => ({ call }) }));

import { createLiveBridgeServer } from '../../src/lib/connectors/bridge-server';
import { bridgePayloadHash } from '../../src/lib/connectors/bridge-idempotency';

async function startBridge() {
  const server = createLiveBridgeServer({ port: 0, authToken: 'secret', liveUrl: 'https://social.example' });
  await server.start();
  const port = (server as unknown as { server: { address: () => { port: number } } }).server.address().port;
  const send = (key: string | undefined, payload: Record<string, unknown> = { action: 'publishPost', platform: 'instagram', body: 'hello' }) => fetch(`http://127.0.0.1:${port}/bridge`, {
    method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json', ...(key ? { 'x-komenin-idempotency-key': key } : {}) }, body: JSON.stringify(payload),
  });
  return { server, send };
}

beforeEach(() => { rows.clear(); state.databaseFailure = false; call.mockClear(); create.mockClear(); findUnique.mockClear(); updateMany.mockClear(); });

describe('persistent bridge idempotency', () => {
  it('rejects live mutations without a key without external IO', async () => {
    const bridge = await startBridge();
    try { expect((await bridge.send(undefined)).status).toBe(400); expect(call).not.toHaveBeenCalled(); }
    finally { await bridge.server.stop(); }
  });

  it('replays the saved status and body across server restarts', async () => {
    const first = await startBridge();
    let original: Response;
    try { original = await first.send('key-1'); expect(original.status).toBe(200); }
    finally { await first.server.stop(); }
    const second = await startBridge();
    try { const replay = await second.send('key-1'); expect(replay.status).toBe(original!.status); expect(await replay.json()).toEqual(await original!.json()); expect(call).toHaveBeenCalledTimes(1); }
    finally { await second.server.stop(); }
  });

  it('returns conflict for one key reused with different payload', async () => {
    const bridge = await startBridge();
    try { await bridge.send('key-1'); expect((await bridge.send('key-1', { action: 'publishPost', platform: 'instagram', body: 'different' })).status).toBe(409); expect(call).toHaveBeenCalledTimes(1); }
    finally { await bridge.server.stop(); }
  });

  it('never repeats external IO for a pending claim', async () => {
    const bridge = await startBridge();
    try { state.databaseFailure = true; expect((await bridge.send('key-1')).status).toBe(503); expect(call).not.toHaveBeenCalled(); state.databaseFailure = false;
      rows.set('key-1', { key: 'key-1', payloadHash: bridgePayloadHash({ action: 'publishPost', platform: 'instagram', body: 'hello' }), status: 'pending', httpStatus: null, response: null, expiresAt: new Date(Date.now() - 86_400_000) });
      expect((await bridge.send('key-1')).status).toBe(503); expect(call).not.toHaveBeenCalled();
    } finally { await bridge.server.stop(); }
  });

  it('does not repeat IO when response persistence fails after sending upstream', async () => {
    const bridge = await startBridge();
    try { updateMany.mockRejectedValueOnce(new Error('write unavailable')); expect((await bridge.send('key-1')).status).toBe(503); expect((await bridge.send('key-1')).status).toBe(503); expect(call).toHaveBeenCalledTimes(1); }
    finally { await bridge.server.stop(); }
  });

  it('leaves a transport-ambiguous mutation pending and never repeats platform IO', async () => {
    const bridge = await startBridge();
    try {
      call.mockRejectedValueOnce(new Error('upstream response lost after platform IO'));
      const first = await bridge.send('unknown-key');
      expect(first.status).toBe(503);
      expect(rows.get('unknown-key')?.status).toBe('pending');
      expect(updateMany).not.toHaveBeenCalled();
      const retry = await bridge.send('unknown-key');
      expect(retry.status).toBe(503);
      expect(call).toHaveBeenCalledTimes(1);
    } finally { await bridge.server.stop(); }
  });

  it('replays a saved upstream error rather than sending it again', async () => {
    const bridge = await startBridge();
    try {
      call.mockResolvedValueOnce({ status: 429, body: { ok: false, externalId: 'rate-limited' } });
      expect((await bridge.send('error-key')).status).toBe(429);
      const replay = await bridge.send('error-key');
      expect(replay.status).toBe(429);
      expect(await replay.json()).toEqual({ ok: false, externalId: 'rate-limited' });
      expect(call).toHaveBeenCalledTimes(1);
    } finally { await bridge.server.stop(); }
  });

  it('atomically admits just one concurrent claimant across independent servers', async () => {
    const a = await startBridge(); const b = await startBridge();
    try { const result = await Promise.all([a.send('key-1'), b.send('key-1')]); expect(call).toHaveBeenCalledTimes(1); expect(result.map(r => r.status).every(s => s === 200 || s === 409 || s === 503)).toBe(true); }
    finally { await a.server.stop(); await b.server.stop(); }
  });
});
