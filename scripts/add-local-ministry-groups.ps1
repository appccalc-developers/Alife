param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $repoRoot 'backend/src/Alife.Api/local.settings.json'
$settings = Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$connectionString = $settings.Values.ConnectionStrings__Default
$connectionBuilder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder($connectionString)

# This operation is intentionally restricted to the existing local development database.
if ($connectionBuilder.DataSource -ne 'localhost,14333' -or $connectionBuilder.InitialCatalog -ne 'alife_db') {
    throw 'This script only supports localhost,14333 / alife_db from API local.settings.json.'
}

$groups = @(
    @{ en = 'Pastoral Team'; zh = '教牧团' },
    @{ en = 'Deacon Board'; zh = '执事会' },
    @{ en = 'Media Ministry'; zh = '媒体事工组' },
    @{ en = 'Worship Team'; zh = '敬拜赞美团' },
    @{ en = 'PA Team'; zh = 'PA组' },
    @{ en = 'PPT Team'; zh = 'PPT组' }
)

$connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
$transaction = $null
$results = @()
try {
    $connection.Open()
    $transaction = $connection.BeginTransaction([System.Data.IsolationLevel]::Serializable)
    foreach ($group in $groups) {
        $command = $connection.CreateCommand()
        $command.Transaction = $transaction
        $command.CommandText = @'
SET XACT_ABORT ON;
IF COL_LENGTH('groups', 'group_type') IS NULL
    THROW 50000, 'Apply AddGroupType before creating ministry groups.', 1;
IF (SELECT COUNT(*) FROM groups WHERE is_church = 1 AND is_closed = 0) <> 1
    THROW 50000, 'Expected exactly one active local church.', 1;

DECLARE @parent uniqueidentifier = (SELECT id FROM groups WHERE is_church = 1 AND is_closed = 0);
IF (SELECT COUNT(*) FROM groups WHERE parent_group_id = @parent
    AND (JSON_VALUE(name_json, '$.en') = @en OR JSON_VALUE(name_json, '$.zh') = @zh)) > 1
    THROW 50000, 'Multiple matching groups exist; resolve duplicates before retrying.', 1;

DECLARE @id uniqueidentifier = (SELECT id FROM groups WHERE parent_group_id = @parent
    AND (JSON_VALUE(name_json, '$.en') = @en OR JSON_VALUE(name_json, '$.zh') = @zh));
DECLARE @created bit = 0;
IF @id IS NOT NULL AND EXISTS (SELECT 1 FROM groups WHERE id = @id
    AND (group_type <> 1 OR is_church = 1 OR is_closed = 1 OR access_type <> 1))
    THROW 50000, 'An incompatible matching group exists; no existing group was changed.', 1;

IF @id IS NULL
BEGIN
    SET @id = NEWID();
    INSERT INTO groups (id, name_json, description_json, parent_group_id, access_type,
        group_type, is_church, is_closed, created_utc, updated_utc)
    VALUES (@id, @name, NULL, @parent, 1, 1, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME());
    SET @created = 1;
END;
SELECT @id AS id, @zh AS name, @created AS created;
'@
        [void]$command.Parameters.Add('@en', [System.Data.SqlDbType]::NVarChar, 150)
        [void]$command.Parameters.Add('@zh', [System.Data.SqlDbType]::NVarChar, 150)
        [void]$command.Parameters.Add('@name', [System.Data.SqlDbType]::NVarChar, -1)
        $command.Parameters['@en'].Value = $group.en
        $command.Parameters['@zh'].Value = $group.zh
        $command.Parameters['@name'].Value = ($group | ConvertTo-Json -Compress)
        try {
            $reader = $command.ExecuteReader()
            try {
                [void]$reader.Read()
                $results += [pscustomobject]@{ Id = $reader['id']; Name = $reader['name']; Created = $reader['created'] }
            } finally { $reader.Dispose() }
        } finally { $command.Dispose() }
    }
    $transaction.Commit()
    $results
} catch {
    if ($transaction) { try { $transaction.Rollback() } catch { } }
    throw
} finally {
    if ($transaction) { $transaction.Dispose() }
    $connection.Dispose()
}
