// Who counts as "one caller" for the rate limits, without accounts. A household or phone
// usually has one IPv4 address but a whole IPv6 /64 (devices rotate addresses inside it),
// so the limits key on the full IPv4 address or the /64 prefix. Only a salted hash of
// that key is ever stored, and the day is part of the hash, so stored rows can't be
// linked across days.

/** The network part of a client address: the full IPv4 address, or the IPv6 /64 prefix. */
export function networkKey(ip: string | null | undefined): string {
  const s = (ip ?? '').trim();
  // Cloudflare always sends CF-Connecting-IP in production; without it (local dev),
  // every caller shares one bucket.
  if (!s) return 'unknown';
  if (isIPv4(s)) return `v4:${s}`;
  const groups = parseIPv6(s);
  if (!groups) return `other:${s}`;
  // IPv4-mapped (::ffff:1.2.3.4) is really an IPv4 caller.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return `v4:${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
  }
  return `v6:${groups.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64`;
}

function isIPv4(s: string): boolean {
  const parts = s.split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/** The eight 16-bit groups of an IPv6 address, or null if it isn't one. */
export function parseIPv6(input: string): number[] | null {
  let s = input.replace(/^\[|\]$/g, '').replace(/%.*$/, ''); // brackets and zone id
  const tail: number[] = [];
  const v4 = s.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    if (!isIPv4(v4[1])) return null;
    const [a, b, c, d] = v4[1].split('.').map(Number);
    tail.push((a << 8) | b, (c << 8) | d);
    s = `${s.slice(0, -v4[1].length)}0:0`; // two placeholder groups, replaced below
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':'));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  if (![...head, ...rest].every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  const known = head.length + rest.length;
  if (halves.length === 1 ? known !== 8 : known > 7) return null;
  const groups = [...head, ...Array(8 - known).fill('0'), ...rest].map((g) => parseInt(g, 16));
  if (tail.length) groups.splice(6, 2, ...tail);
  return groups;
}

/** Placeholder salt when NETWORK_SALT isn't set; see the README for why to set one. */
export const DEFAULT_NETWORK_SALT = 'trait-trainer-network-v1';

/** A salted, per-day SHA-256 of the network key (hex, 128 bits): what the limits store instead of addresses. */
export async function networkHash(key: string, salt: string, day: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${day}|${key}`));
  return [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
