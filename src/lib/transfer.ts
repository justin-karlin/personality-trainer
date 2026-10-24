// Moving data between browsers without a server. On iPhone, Safari and the Home Screen
// app keep separate storage, so someone who starts in Safari and then installs the app
// arrives at an empty app. A transfer code is the whole state, compressed and encoded as
// text: copy it in one place, paste it in the other.
import type { AppState } from '../types';
import { parseState } from './storage';
import { isNative } from './native';

const PREFIX = 'TT1.';

/** True on iPhone/iPad when the page is open in the browser rather than as the installed app. */
export function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !isInstalled();
}

/** Running as an installed app (Home Screen / standalone window). */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNative()) return true;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Ask the browser not to clear our storage under pressure (Safari otherwise may, after weeks unused). */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // Not supported: nothing to do.
  }
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64 = (text: string) => {
  const b = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Encode the state as a short-ish text code (gzip + base64url where supported). */
export async function makeTransferCode(state: AppState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(state));
  if (typeof CompressionStream !== 'undefined') return `${PREFIX}z${toBase64(await pipe(json, new CompressionStream('gzip')))}`;
  return `${PREFIX}j${toBase64(json)}`;
}

/** Decode and validate a transfer code (throws a readable error if it isn't one). */
export async function readTransferCode(code: string): Promise<AppState> {
  const clean = code.trim().replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) throw new Error('That doesn’t look like a Trait5 transfer code.');
  const kind = clean[PREFIX.length];
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(clean.slice(PREFIX.length + 1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('gzip'));
    else if (kind !== 'j') throw new Error();
  } catch {
    throw new Error('The transfer code is incomplete. Copy it again and paste the whole thing.');
  }
  return parseState(JSON.parse(new TextDecoder().decode(bytes)));
}
