import { describe, expect, it } from 'vitest';
import { BodyTooLarge, MAX_BODY_BYTES, readBody } from './body';
import { networkHash, networkKey, parseIPv6 } from './network';

describe('network key', () => {
  it('uses the full IPv4 address', () => {
    expect(networkKey('203.0.113.7')).toBe('v4:203.0.113.7');
    expect(networkKey(' 203.0.113.7 ')).toBe('v4:203.0.113.7');
    expect(networkKey('203.0.113.8')).not.toBe(networkKey('203.0.113.7'));
  });

  it('uses the IPv6 /64 prefix, however the address is written', () => {
    const key = 'v6:2001:db8:abcd:12::/64';
    expect(networkKey('2001:db8:abcd:12:1:2:3:4')).toBe(key);
    expect(networkKey('2001:0DB8:abcd:0012::ffff')).toBe(key);
    expect(networkKey('2001:db8:abcd:12::')).toBe(key);
    expect(networkKey('2001:db8:abcd:13::1')).not.toBe(key);
    expect(networkKey('::1')).toBe('v6:0:0:0:0::/64');
  });

  it('treats an IPv4-mapped IPv6 address as IPv4', () => {
    expect(networkKey('::ffff:198.51.100.2')).toBe('v4:198.51.100.2');
  });

  it('puts callers without the header in one shared bucket', () => {
    expect(networkKey(null)).toBe('unknown');
    expect(networkKey(undefined)).toBe('unknown');
    expect(networkKey('  ')).toBe('unknown');
  });

  it('keeps anything unparseable separate rather than guessing', () => {
    expect(networkKey('999.1.1.1')).toBe('other:999.1.1.1');
    expect(networkKey('1:2:3')).toBe('other:1:2:3');
    expect(parseIPv6('1::2::3')).toBeNull();
    expect(parseIPv6('1:2:3:4:5:6:7:8:9')).toBeNull();
    expect(parseIPv6('1:2:3:4:5:6:1.2.3.4')).toEqual([1, 2, 3, 4, 5, 6, 0x0102, 0x0304]);
    expect(parseIPv6('fe80::1%eth0')).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('stores only a salted daily hash', async () => {
    const h = await networkHash('v4:203.0.113.7', 'salt', '2026-10-15');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain('203');
    expect(await networkHash('v4:203.0.113.7', 'salt', '2026-10-15')).toBe(h);
    expect(await networkHash('v4:203.0.113.7', 'other', '2026-10-15')).not.toBe(h);
    expect(await networkHash('v4:203.0.113.7', 'salt', '2026-10-16')).not.toBe(h); // unlinkable across days
    expect(await networkHash('v4:203.0.113.8', 'salt', '2026-10-15')).not.toBe(h);
  });
});

describe('body size', () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request('https://x.example/', { method: 'POST', body, headers });

  it('reads bodies up to 16 KB', async () => {
    expect(await readBody(post('x'.repeat(MAX_BODY_BYTES)))).toHaveLength(MAX_BODY_BYTES);
    expect(await readBody(new Request('https://x.example/'))).toBe('');
  });

  it('counts UTF-8 bytes, not characters', async () => {
    // 8,200 characters but 16,400 bytes.
    await expect(readBody(post('é'.repeat(8200)))).rejects.toBeInstanceOf(BodyTooLarge);
    expect(await readBody(post('é'.repeat(8000)))).toBe('é'.repeat(8000));
  });

  it('refuses on Content-Length before reading, and on the bytes when the header is missing', async () => {
    await expect(readBody(post('{}', { 'Content-Length': String(MAX_BODY_BYTES + 1) }))).rejects.toBeInstanceOf(BodyTooLarge);
    const chunk = new TextEncoder().encode('x'.repeat(4096));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent++ < 10) c.enqueue(chunk);
        else c.close();
      },
    });
    const req = new Request('https://x.example/', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    await expect(readBody(req)).rejects.toBeInstanceOf(BodyTooLarge);
    expect(sent).toBeLessThan(10); // stopped reading once over the limit
  });
});
