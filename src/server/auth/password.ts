import 'server-only';
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { RateLimitError } from '@/domain/errors';

/**
 * scrypt password hashing (memory-hard, built into Node — no native addons).
 * Stored format: scrypt$N$r$p$<salt b64url>$<hash b64url>, so parameters can be
 * raised later and old hashes still verify.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * PARAMS.N * PARAMS.r * 2;

/**
 * Each derivation holds ~32 MB and one of libuv's four worker threads for
 * ~100 ms, the same threads file reads use. Running at most two at a time, and
 * refusing once a queue builds up, keeps a sign-in flood from starving the rest
 * of the server.
 */
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 50;
let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running < MAX_CONCURRENT) {
    running += 1;
  } else {
    if (waiting.length >= MAX_QUEUED) throw new RateLimitError(5, 'Sign-in is busy. Try again in a few seconds.');
    await new Promise<void>((resolve) => waiting.push(resolve)); // the releasing task hands over its slot
  }
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  }
}

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return withSlot(
    () =>
      new Promise((resolve, reject) => {
        scrypt(password.normalize('NFKC'), salt, keyLength, { ...options, maxmem: MAX_MEM }, (err, key) =>
          err ? reject(err) : resolve(key),
        );
      }),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Hash used to spend equal time when an account does not exist (prevents user
 * enumeration). A failed attempt (sign-in busy) is not kept, or every later
 * sign-in to an unknown email would fail the same way.
 */
let dummyHash: Promise<string> | undefined;
export function timingSafeDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(12).toString('hex')).catch((err: unknown) => {
    dummyHash = undefined;
    throw err;
  });
  return dummyHash;
}
