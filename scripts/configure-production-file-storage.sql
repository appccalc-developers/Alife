-- Operational configuration repair; run only against the explicitly approved production database.
-- No schema or FileAssets data is changed. Existing provider rows remain active for historical files.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM file_storage_providers WITH (UPDLOCK, HOLDLOCK) WHERE code = 'cloudflare-r2')
BEGIN
    INSERT INTO file_storage_providers (
        id, code, kind, display_name_json, is_active, is_default, bucket_name,
        public_base_url, private_base_url, upload_api_base_url, public_path_prefix, private_path_prefix,
        supports_public_url, supports_signed_read, supports_server_side_move, created_utc, updated_utc)
    VALUES (
        'f1111111-1111-4111-8111-111111111111', 'cloudflare-r2', 1,
        N'{"en":"Cloudflare R2 file storage","zh":"Cloudflare R2 文件存储"}', 1, 0, 'ccalc',
        'https://images.ccalc.live', 'https://images.ccalc.live', 'https://images.ccalc.live', '', 'private',
        1, 1, 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;

UPDATE file_storage_providers
SET is_default = 0, updated_utc = SYSUTCDATETIME()
WHERE is_default = 1 AND code <> 'cloudflare-r2';

UPDATE file_storage_providers
SET kind = 1, is_active = 1, is_default = 1, bucket_name = 'ccalc',
    public_base_url = 'https://images.ccalc.live',
    private_base_url = 'https://images.ccalc.live',
    upload_api_base_url = 'https://images.ccalc.live',
    public_path_prefix = '', private_path_prefix = 'private',
    supports_public_url = 1, supports_signed_read = 1, supports_server_side_move = 1,
    updated_utc = SYSUTCDATETIME()
WHERE code = 'cloudflare-r2';

COMMIT TRANSACTION;

SELECT code, is_active, is_default, bucket_name, upload_api_base_url, private_base_url
FROM file_storage_providers;
