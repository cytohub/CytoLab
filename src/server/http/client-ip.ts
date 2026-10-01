import 'server-only';
import { isIPv4, isIPv6 } from 'node:net';

/**
 * Canonical form of a client address: IPv4 without leading zeros or the
 * IPv4-mapped IPv6 prefix, IPv6 fully expanded. Anything that is not an
 * address counts as unknown.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/^\[(.*)\]$/, '$1');
  if (/^::ffff:/i.test(value) && isIPv4(value.slice(7))) value = value.slice(7);

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    return octets.every((n) => n <= 255) ? octets.join('.') : null;
  }
  return isIPv6(value) ? expandIPv6(value).join(':') : null;
}

/**
 * The key a rate limit counts against. One subscriber controls a whole IPv6
 * /64, so rotating addresses inside it must not reset the count.
 */
export function ipBucket(ip: string | null): string {
  if (!ip) return 'unknown';
  return ip.includes(':') ? `${ip.split(':').slice(0, 4).join(':')}::/64` : ip;
}

function expandIPv6(value: string): string[] {
  const address = value.split('%')[0]!; // drop a zone id such as %eth0
  const [head, tail] = address.includes('::') ? address.split('::') : [address, undefined];
  const toHextets = (part: string | undefined) =>
    (part ? part.split(':') : []).flatMap((group) => {
      if (!group.includes('.')) return [group];
      const [a, b, c, d] = group.split('.').map(Number) as [number, number, number, number];
      return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
    });
  const left = toHextets(head);
  const right = toHextets(tail);
  const groups = tail === undefined ? left : [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right];
  return groups.map((group) => parseInt(group, 16).toString(16));
}
