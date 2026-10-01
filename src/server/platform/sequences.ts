import 'server-only';
import { sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { idSequences } from '../db/schema';

export type SequenceScope = 'experiment' | 'sample' | `milestone:${string}`;

/**
 * Atomically allocates the next value of a per-org counter. The upsert takes a row
 * lock, so concurrent transactions receive distinct values; a rolled-back
 * transaction releases its number (gaps are acceptable, duplicates are not).
 */
export async function nextSequenceValue(tx: Executor, orgId: string, scope: SequenceScope): Promise<number> {
  const [row] = await tx
    .insert(idSequences)
    .values({ orgId, scope, lastValue: 1 })
    .onConflictDoUpdate({
      target: [idSequences.orgId, idSequences.scope],
      set: { lastValue: sql`${idSequences.lastValue} + 1` },
    })
    .returning({ value: idSequences.lastValue });
  return row!.value;
}

/** Ensures a counter is at least `value` (used when importing records with existing numbers). */
export async function bumpSequenceTo(tx: Executor, orgId: string, scope: SequenceScope, value: number): Promise<void> {
  await tx
    .insert(idSequences)
    .values({ orgId, scope, lastValue: value })
    .onConflictDoUpdate({
      target: [idSequences.orgId, idSequences.scope],
      set: { lastValue: sql`greatest(${idSequences.lastValue}, ${value})` },
    });
}

/**
 * The next value, but always above `highestInUse`: records numbered without
 * the counter (seed data from before it was kept, imports) are skipped instead
 * of colliding on every create. The upsert's row lock still serializes callers.
 */
export async function nextSequenceAbove(tx: Executor, orgId: string, scope: SequenceScope, highestInUse: number): Promise<number> {
  await bumpSequenceTo(tx, orgId, scope, highestInUse);
  return nextSequenceValue(tx, orgId, scope);
}
