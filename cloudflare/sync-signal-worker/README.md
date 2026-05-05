# Alife Sync Signal Worker

Cloudflare Worker for resilient PWA version signaling.

## Routes

- `PUT /kv/{key}` stores a Unix millisecond version for one entity key.
- `GET /kv/bulk?keys=a,b,c` returns versions for up to 100 keys.

Both routes require `Authorization: Bearer <SYNC_API_TOKEN>`.

## Bindings

Configure these in Cloudflare:

- KV namespace binding: `SYNC_VERSIONS`
- Worker secret: `SYNC_API_TOKEN`

The Azure API should set:

- `Cloudflare:SyncWorkerBaseUrl`
- `Cloudflare:SyncApiToken`

