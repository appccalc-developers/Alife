import { sameSecret } from './sunday-bulletins.js';

const keyPattern = /^private\/event-registration\/[a-f0-9]{32}\/[a-f0-9]{32}\/[a-f0-9]{32}\.(jpg|jpeg|png|pdf|txt)$/;
const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf', txt: 'text/plain' };
const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-disposition': 'attachment' };
const reply = status => new Response(null, { status, headers });

export async function handleRegistrationMaterial(request, env) {
  const url = new URL(request.url), uploadPrefix = '/api/admin/event-registration/', readPrefix = '/api/private-files/private/event-registration/';
  const upload = url.pathname.startsWith(uploadPrefix);
  if (!upload && !url.pathname.startsWith(readPrefix)) return null;
  let key;
  try { key = decodeURIComponent(url.pathname.slice(upload ? uploadPrefix.length : '/api/private-files/'.length)); } catch { return reply(400); }
  const match = keyPattern.exec(key);
  if (!match) return reply(404);
  const type = types[match[1]];
  if (upload) {
    if (!await sameSecret(request.headers.get('x-alife-file-admin-secret'), env.FILE_ADMIN_BACKFILL_SECRET)) return reply(403);
    if (request.method === 'GET') {
      const object = await env.IMAGE_BUCKET.get(key);
      return object ? new Response(object.body, { headers: { ...headers, 'content-type': type } }) : reply(404);
    }
    if (request.method !== 'PUT') return reply(405);
    if (!request.body || request.headers.get('content-type') !== type) return reply(400);
    const reader = request.body.getReader(), chunks = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 20 * 1024 * 1024) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const valid = type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
      : type === 'application/pdf' ? new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-' : validText(bytes);
    if (!size || !valid) return reply(400);
    await env.IMAGE_BUCKET.put(key, bytes, { httpMetadata: { contentType: type, contentDisposition: 'attachment', cacheControl: 'private, no-store' } });
    return reply(204);
  }
  // Materials are streamed by the application after checking current participant/role access.
  // Bearer links would remain usable after revocation, even with a short expiry.
  return reply(403);
}
function validText(bytes) { try { return !new TextDecoder('utf-8', { fatal: true }).decode(bytes).includes('\0'); } catch { return false; } }
