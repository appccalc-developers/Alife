const KEY_PATTERN = /^private\/sunday-bulletins\/[0-9a-f-]{36}\/\d{4}-\d{2}-\d{2}\.pdf$/;
const MAX_BYTES = 20 * 1024 * 1024;
const encoder = new TextEncoder();

const reply = (status) => new Response(null, { status, headers: { 'cache-control': 'private, no-store' } });

async function sameSecret(actual, expected) {
  if (!actual || !expected) return false;
  const [a, b] = await Promise.all([actual, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function handleSundayBulletin(request, env) {
  const url = new URL(request.url);
  const uploadPrefix = '/api/admin/sunday-bulletins/';
  const readPrefix = '/api/private-files/';
  const upload = url.pathname.startsWith(uploadPrefix);
  if (!upload && !url.pathname.startsWith(readPrefix)) return null;
  const key = decodeURIComponent(url.pathname.slice((upload ? uploadPrefix : readPrefix).length));
  if (!KEY_PATTERN.test(key)) return reply(404);

  if (upload) {
    if (request.method !== 'PUT') return reply(405);
    if (!await sameSecret(request.headers.get('x-alife-file-admin-secret'), env.FILE_ADMIN_BACKFILL_SECRET)) return reply(403);
    if (request.headers.get('content-type') !== 'application/pdf' || !request.body) return reply(400);
    const reader = request.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') return reply(400);
    await env.IMAGE_BUCKET.put(key, bytes, { httpMetadata: {
      contentType: 'application/pdf', contentDisposition: 'inline', cacheControl: 'private, no-store',
    } });
    return reply(204);
  }

  if (!['GET', 'HEAD'].includes(request.method)) return reply(405);
  const exp = url.searchParams.get('exp') ?? '';
  const sig = url.searchParams.get('sig') ?? '';
  const now = Math.floor(Date.now() / 1000);
  if (!env.FILE_ACCESS_SIGNING_SECRET || !/^\d+$/.test(exp) || Number(exp) <= now || Number(exp) > now + 300 || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return reply(403);
  const signingKey = await crypto.subtle.importKey('raw', encoder.encode(env.FILE_ACCESS_SIGNING_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signature = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/') + '='), char => char.charCodeAt(0));
  if (!await crypto.subtle.verify('HMAC', signingKey, signature, encoder.encode(`${key}\n${exp}`))) return reply(403);
  const object = request.method === 'HEAD' ? await env.IMAGE_BUCKET.head(key) : await env.IMAGE_BUCKET.get(key);
  if (!object) return reply(404);
  return new Response(request.method === 'HEAD' ? null : object.body, { headers: {
    'content-type': 'application/pdf', 'content-disposition': 'inline',
    'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  } });
}

export const isBulletinPath = (path) => {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return normalized === 'private' || normalized === 'private/sunday-bulletins' || normalized.startsWith('private/sunday-bulletins/');
};
