import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './pagination';

describe('activity cursors', () => {
  it('round-trips a cursor', () => {
    const at = new Date('2026-03-04T05:06:07.000Z');
    expect(decodeCursor(encodeCursor(at, '01a0f303-3b78-7ac5-90eb-541fd33eff3f'))).toEqual({ occurredAt: at, id: '01a0f303-3b78-7ac5-90eb-541fd33eff3f' });
  });

  it('ignores a cursor whose id is not a UUID instead of sending it to the database', () => {
    expect(decodeCursor(Buffer.from('2026-01-01T00:00:00Z|not-a-uuid').toString('base64url'))).toBeNull();
    expect(decodeCursor(encodeCursor(new Date('2026-01-01T00:00:00Z'), "1' or '1'='1"))).toBeNull();
  });
});
