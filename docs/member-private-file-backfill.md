# Member-private file backfill

This backfill moves old member-private uploads behind the signed Worker route.

## Required secrets

- Backend: `FileAssets__ImageApiAdminSecret`
- Images Worker: `FILE_ADMIN_BACKFILL_SECRET`

Both values must match. The existing signed-read secret is separate:

- Backend: `FileAssets__PrivateFileSigningSecret`
- Images Worker: `FILE_ACCESS_SIGNING_SECRET`

## API

Dry-run first:

```http
POST /api/admin/file-assets/member-private/backfill
Content-Type: application/json

{
  "dryRun": true,
  "maxItems": 50
}
```

Execute in batches:

```http
POST /api/admin/file-assets/member-private/backfill
Content-Type: application/json

{
  "dryRun": false,
  "maxItems": 50
}
```

Only super admins can run this command.

## Behavior

For each active `memberPrivate` FileAsset where `public_url` is still set or `object_key` is not under `private/`:

1. Compute `targetKey = private/{sourceKey}` when needed.
2. Ask the images Worker to move the R2 object.
3. After the Worker confirms success, update `FileAsset.object_key`.
4. Clear `FileAsset.public_url`.

The command saves metadata per file after its object move succeeds, so a partial failure can be safely retried.

## Why this is not an EF migration

The R2 object move and database metadata update must stay coordinated. A pure SQL migration could clear `public_url` or rewrite `object_key` before the object exists at the private path, breaking access for existing files.
