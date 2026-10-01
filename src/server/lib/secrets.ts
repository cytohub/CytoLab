import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Compares fixed-length digests, so the time taken reveals nothing about either value, its length included. */
export function sameSecret(provided: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}
