import { sameSecret } from './sunday-bulletins.js';

// Exact-key, authenticated deletion. Never fall back to recursive prefix deletion.
export async function handleDeleteObject(request, env) {
  if (new URL(request.url).pathname !== '/api/admin/file-objects/delete') return null;
  const reply = status => new Response(null, { status, headers: { 'cache-control': 'private, no-store' } });
  if (request.method !== 'POST') return reply(405);
  if (!await sameSecret(request.headers.get('x-alife-file-admin-secret'), env.FILE_ADMIN_BACKFILL_SECRET)) return reply(403);
  let input;
  try { input = await request.json(); } catch { return reply(400); }
  const key = input?.objectKey;
  const groupId = input?.groupId;
  if (typeof key !== 'string' || !key || key.length > 1024 || key.endsWith('/') ||
      key.startsWith('/') || key.split('/').some(part => !part || part === '.' || part === '..') ||
      typeof groupId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(groupId) ||
      !(key.startsWith(`groups/${groupId}/`) || key.startsWith(`private/groups/${groupId}/`)) ||
      input.bucketName !== env.R2_BUCKET_NAME) return reply(400);
  await env.IMAGE_BUCKET.delete(key);
  return reply(204);
}
