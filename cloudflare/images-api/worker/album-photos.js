import { sameSecret } from './sunday-bulletins.js';

// Album originals never have a public storage URL, including legacy objects.
export const isAlbumObject = key => /^(?:private\/)?groups\/[^/]+\/albums(?:\/|$)/i.test(key);
export const containsAlbumObjects = key => isAlbumObject(key) || /^(?:private\/)?groups(?:\/[^/]+)?\/?$/i.test(key);
const validKey = /^(?:private\/)?groups\/[0-9a-f-]{36}\/albums\/[0-9a-f-]{36}\/[^/\\]+$/i;
export const MAX_ALBUM_BYTES = 20 * 1024 * 1024;

export async function handleAlbumPhoto(request, env) {
  const prefix = '/api/admin/album-photos/';
  const path = new URL(request.url).pathname;
  const reply = status => new Response(null, { status, headers: { 'cache-control': 'private, no-store' } });
  if (!path.startsWith(prefix)) {
    let key;
    try { key = decodeURIComponent(path.replace(/^\/api\/images\//, '').replace(/^\//, '')); } catch { return reply(400); }
    if (!isAlbumObject(key)) return null;
    if (!['GET', 'HEAD'].includes(request.method) || !validKey.test(key) || key.includes('..')) return reply(404);
    const target = new URL('/api/album-photo-objects', env.ALBUM_API_BASE_URL || 'https://api.ccalc.live');
    target.searchParams.set('key', key);
    const headers = new Headers();
    for (const name of ['cookie', 'authorization']) if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    // The backend rechecks membership/visibility and reads storage through the
    // separate admin route below. Never serve an R2 object directly here.
    try {
      const response = await fetch(target, { headers, redirect: 'manual', cf: { cacheTtl: 0, cacheEverything: false } });
      const output = new Headers(response.headers);
      output.set('cache-control', 'private, no-store');
      output.set('vary', 'Cookie, Authorization');
      if (request.method === 'HEAD') await response.body?.cancel();
      return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers: output });
    } catch { return reply(503); }
  }
  if (!await sameSecret(request.headers.get('x-alife-file-admin-secret'), env.FILE_ADMIN_BACKFILL_SECRET)) return reply(403);
  let key;
  try { key = decodeURIComponent(path.slice(prefix.length)); } catch { return reply(400); }
  if (!validKey.test(key) || key.includes('..')) return reply(400);
  if (request.method === 'DELETE') { await env.IMAGE_BUCKET.delete(key); return reply(204); }
  if (request.method === 'PUT') {
    if (!key.startsWith('private/') || !['image/jpeg', 'image/png', 'image/webp'].includes(request.headers.get('content-type')) || !request.body) return reply(400);
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ALBUM_BYTES) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    if (!size) return reply(400);
    await env.IMAGE_BUCKET.put(key, new Blob(chunks).stream(), { httpMetadata: {
      contentType: request.headers.get('content-type'), cacheControl: 'private, no-store',
    } });
    return reply(204);
  }
  if (!['GET', 'HEAD'].includes(request.method)) return reply(405);
  const object = request.method === 'HEAD' ? await env.IMAGE_BUCKET.head(key) : await env.IMAGE_BUCKET.get(key);
  if (!object) return reply(404);
  return new Response(request.method === 'HEAD' ? null : object.body, { headers: {
    'content-type': object.httpMetadata?.contentType || 'application/octet-stream',
    'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
  } });
}
