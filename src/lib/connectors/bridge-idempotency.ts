import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export type BridgeOutcome = { status: number; body: unknown };
const TTL_MS = 24 * 60 * 60 * 1000;

/** Canonicalize JSON object key order so equivalent HTTP JSON bodies share a fingerprint. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function bridgePayloadHash(payload: unknown): string {
  return createHash('sha256').update(canonical(payload)).digest('hex');
}

type Claim = { kind: 'claimed' } | { kind: 'replay'; outcome: BridgeOutcome } | { kind: 'conflict' } | { kind: 'pending' };

/** The unique database key, not a per-process lock, arbitrates competing bridge instances. */
export async function claimBridgeKey(key: string, payloadHash: string): Promise<Claim> {
  try {
    await db.bridgeIdempotency.create({ data: {
      key, payloadHash, status: 'pending', expiresAt: new Date(Date.now() + TTL_MS),
    } });
    return { kind: 'claimed' };
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')) throw error;
  }
  const existing = await db.bridgeIdempotency.findUnique({ where: { key } });
  if (!existing) throw new Error('Bridge claim disappeared');
  if (existing.payloadHash !== payloadHash) return { kind: 'conflict' };
  if (existing.status === 'completed' && existing.httpStatus !== null && existing.response !== null) {
    return { kind: 'replay', outcome: { status: existing.httpStatus, body: existing.response } };
  }
  // Even beyond expiresAt, an unresolved claim is never safe to retry: the
  // external side effect may have happened just before the bridge crashed.
  return { kind: 'pending' };
}

/** Persist first; callers may only respond after this write succeeds. */
export async function saveBridgeOutcome(key: string, payloadHash: string, outcome: BridgeOutcome): Promise<void> {
  const saved = await db.bridgeIdempotency.updateMany({
    where: { key, payloadHash, status: 'pending' },
    data: { status: 'completed', httpStatus: outcome.status, response: outcome.body as Prisma.InputJsonValue },
  });
  if (saved.count !== 1) throw new Error('Bridge outcome could not be persisted');
}
