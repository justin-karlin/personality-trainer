// Reading a request body with a hard size limit. The app's largest request (a review with
// six plans and a full reflection) is a few KB, so anything much bigger is a mistake or
// abuse, and is refused before it's parsed or sent anywhere.

/** 16 KB of UTF-8. */
export const MAX_BODY_BYTES = 16 * 1024;

export class BodyTooLarge extends Error {}

/**
 * The body as text, or BodyTooLarge once it passes `maxBytes`. Checks Content-Length
 * first, then counts bytes as they arrive, since the header can be missing or wrong.
 */
export async function readBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > maxBytes) throw new BodyTooLarge(`Body over ${maxBytes} bytes.`);
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BodyTooLarge(`Body over ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
