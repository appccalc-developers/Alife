using Alife.Application.Events.Services;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Data;
using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Alife.DbMigrator;

/// <summary>
/// Destructive, explicitly-invoked Event instance reset. This class deliberately uses the
/// live SQL catalogue rather than the current EF model so that an older, known production
/// schema can be inspected without applying migrations first.
/// </summary>
internal sealed partial class EventInstancePurge
{
    private const string ManifestVersion = "event-instance-purge/2";
    private const string NoRecoveryReference = "irreversible-no-recovery";
    private const string NoRecoveryArgument = "--Events:NoRecovery=true";
    private const int MaximumRemoteFilesPerReset = 250;
    private const string LocalResetServer = "localhost,14333";
    private const string LocalResetDatabase = "alife_db";
    private const string LocalResetResource = "local://localhost,14333/alife_db";

    private static readonly HashSet<string> PreservedEventTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "event_activity_template_versions",
        "event_package_governance_policy_versions",
        "event_ram_policy_versions",
        "event_resource_venues",
        "event_safeguarding_policy_versions",
        "event_workflow_templates"
    };

    private static readonly HashSet<string> SpecialEventTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "event_idempotency_records",
        "event_package_approval_delegations"
    };

    // This is the union of the reviewed 67-table production model and the current 75-table
    // model. Missing entries are allowed; a newly introduced event_* table is not.
    private static readonly HashSet<string> KnownInstanceTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "group_events",
        "event_activity_consents",
        "event_activity_module_configurations",
        "event_activity_offers",
        "event_activity_participations",
        "event_activity_payments",
        "event_activity_plans",
        "event_activity_policy_versions",
        "event_activity_space_requests",
        "event_approval_decisions",
        "event_artifacts",
        "event_composition_occurrences",
        "event_composition_series",
        "event_contact_profiles",
        "event_enrollment_history",
        "event_enrollments",
        "event_fact_sets",
        "event_module_report_actions",
        "event_module_report_revisions",
        "event_module_reports",
        "event_operations_roster_assignments",
        "event_operations_roster_availability",
        "event_operations_task_blockers",
        "event_operations_task_dependencies",
        "event_operations_tasks",
        "event_operations_team_members",
        "event_package_conditions",
        "event_package_decisions",
        "event_package_source_references",
        "event_packages",
        "event_participant_private_data",
        "event_plan_snapshots",
        "event_preparation_reopen_requests",
        "event_program_items",
        "event_ram_actions",
        "event_ram_assessments",
        "event_ram_revisions",
        "event_registration_actions",
        "event_registration_applications",
        "event_registration_materials",
        "event_registration_participants",
        "event_registration_policies",
        "event_resource_venue_reservations",
        "event_reviews",
        "event_role_assignments",
        "event_roster_defaults",
        "event_roster_groups",
        "event_safeguarding_authorised_collectors",
        "event_safeguarding_child_attendance",
        "event_safeguarding_child_consents",
        "event_safeguarding_child_registrations",
        "event_safeguarding_configurations",
        "event_safeguarding_guardian_relationships",
        "event_safeguarding_worker_eligibility",
        "event_service_slots",
        "event_sessions",
        "event_task_approval_actions",
        "event_travel_drivers",
        "event_travel_journeys",
        "event_travel_passenger_assignments",
        "event_travel_pickup_stops",
        "event_travel_vehicles",
        "event_venue_booking_exceptions",
        "event_venue_weekly_bookings",
        "event_workflow_runs",
        "event_workflow_steps",
        "event_zones"
    };

    private static readonly HashSet<string> KnownSoftReferenceTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "audit_logs", "notification_messages", "file_assets"
    };

    private static readonly HashSet<string> EventReferenceColumnNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "event_id", "occurrence_id", "event_package_id", "event_session_id", "workflow_run_id"
    };

    private readonly string _connectionString;
    private readonly Options _options;
    private readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private EventInstancePurge(string connectionString, Options options)
    {
        _connectionString = connectionString;
        _options = options;
    }

    internal static bool TryCreate(
        IConfiguration configuration,
        string[] args,
        string connectionString,
        out EventInstancePurge? purge)
    {
        purge = null;
        var modeValue = configuration["Events:PurgeInstances"];
        if (modeValue is null)
            return false;

        if (!args.Any(argument => argument.StartsWith("--Events:PurgeInstances=", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Event purge requires an explicit --Events:PurgeInstances command-line argument.");
        if (!Enum.TryParse<PurgeMode>(modeValue, ignoreCase: true, out var mode))
            throw new InvalidOperationException("Events:PurgeInstances must be preview, apply, or verify.");

        var outputDirectory = Require(configuration, "Events:OutputDirectory");
        if (!Path.IsPathFullyQualified(outputDirectory))
            throw new InvalidOperationException("Events:OutputDirectory must be an absolute path.");

        var environment = Require(configuration, "Events:PurgeEnvironment");
        if (!string.Equals(environment, "Local", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(environment, "Production", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Events:PurgeEnvironment must be explicitly Local or Production.");
        var isProduction = string.Equals(environment, "Production", StringComparison.OrdinalIgnoreCase);
        var noRecovery = configuration.GetValue<bool>("Events:NoRecovery");
        var noRecoveryArguments = args.Count(argument =>
            string.Equals(argument, NoRecoveryArgument, StringComparison.Ordinal));
        if (noRecovery && (!isProduction || noRecoveryArguments != 1))
            throw new InvalidOperationException(
                "Irreversible Event purge is production-only and requires the exact --Events:NoRecovery=true command-line argument once.");
        if (!noRecovery && noRecoveryArguments != 0)
            throw new InvalidOperationException("Events:NoRecovery must match the explicit command-line argument.");
        var expectedDatabase = Require(configuration, "Events:ExpectedDatabase");
        var expectedServer = Require(configuration, "Events:ExpectedServer");
        var targetResource = Require(configuration, "Events:TargetResource");
        if (!isProduction &&
            (!string.Equals(expectedServer, LocalResetServer, StringComparison.OrdinalIgnoreCase) ||
             !string.Equals(expectedDatabase, LocalResetDatabase, StringComparison.Ordinal) ||
             !string.Equals(targetResource, LocalResetResource, StringComparison.Ordinal)))
            throw new InvalidOperationException(
                $"Local Event purge is restricted to {LocalResetServer}/{LocalResetDatabase} with the exact local target resource.");
        if (noRecovery &&
            (!string.IsNullOrWhiteSpace(configuration["Events:VerifiedBackupReference"]) ||
             !string.IsNullOrWhiteSpace(configuration["Events:VerifiedBackupConnectionString"]) ||
             configuration.GetValue<bool>("Events:BackupVerified") ||
             !string.IsNullOrWhiteSpace(configuration["Events:FileBackupReceiptPath"])))
            throw new InvalidOperationException(
                "Irreversible Event purge must not claim a verified SQL or file backup.");
        var backupReference = noRecovery
            ? NoRecoveryReference
            : Require(configuration, "Events:VerifiedBackupReference");
        var backupConnectionString = isProduction && !noRecovery
            ? Require(configuration, "Events:VerifiedBackupConnectionString")
            : null;
        ValidateEvidenceDirectory(configuration, outputDirectory, isProduction);
        if (!isProduction)
            ValidateLocalBackup(backupReference, Require(configuration, "Events:BackupVerificationReceiptPath"), expectedDatabase);

        var options = new Options(
            mode,
            Path.GetFullPath(outputDirectory),
            expectedServer,
            expectedDatabase,
            targetResource,
            Require(configuration, "Events:CodeSha"),
            Require(configuration, "Events:FreezeEpoch"),
            ValidateResetRunId(Require(configuration, "Events:ResetRunId")),
            backupReference,
            noRecovery,
            isProduction,
            configuration.GetValue<bool>("Events:WriteFreezeConfirmed"),
            configuration.GetValue<bool>("Events:BackupVerified"),
            backupConnectionString,
            configuration["Events:ExpectedFingerprint"],
            configuration["Events:FileBackupReceiptPath"],
            configuration["Events:FileDeleteReceiptPath"],
            IsIntegrationTest: false);

        if (isProduction && !options.WriteFreezeConfirmed)
            throw new InvalidOperationException("Production Event purge requires Events:WriteFreezeConfirmed=true.");
        if (mode == PurgeMode.Apply && !noRecovery && !options.BackupVerified)
            throw new InvalidOperationException("Apply requires Events:BackupVerified=true.");
        if (mode == PurgeMode.Apply && string.IsNullOrWhiteSpace(options.ExpectedFingerprint))
            throw new InvalidOperationException("Apply requires the manually approved Events:ExpectedFingerprint.");

        purge = new EventInstancePurge(connectionString, options);
        return true;
    }

    internal static EventInstancePurge CreateForIsolatedIntegrationTest(
        string connectionString,
        string outputDirectory,
        PurgeMode mode,
        string resetRunId,
        string? expectedFingerprint = null,
        bool irreversibleNoRecovery = false)
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("ALIFE_TEST_EVENT_PURGE_SQL"), "1", StringComparison.Ordinal))
            throw new InvalidOperationException("The isolated Event purge test factory requires ALIFE_TEST_EVENT_PURGE_SQL=1.");
        var connection = new SqlConnectionStringBuilder(connectionString);
        if (!string.Equals(connection.DataSource, LocalResetServer, StringComparison.OrdinalIgnoreCase) ||
            !connection.InitialCatalog.StartsWith("AlifeEventPurgeTest_", StringComparison.Ordinal) ||
            connection.InitialCatalog.Length < "AlifeEventPurgeTest_".Length + 16)
            throw new InvalidOperationException("The Event purge test factory only accepts a GUID-suffixed disposable localhost database.");
        if (!Path.IsPathFullyQualified(outputDirectory))
            throw new InvalidOperationException("The Event purge test evidence path must be absolute.");

        var approvedRoot = Path.GetFullPath(Environment.GetEnvironmentVariable("ALIFE_EVENT_PURGE_TEST_OUTPUT_ROOT")
            ?? @"C:\Data\Alife\Temp\EventPurgeTests");
        var fullOutput = Path.GetFullPath(outputDirectory);
        if (!IsWithin(approvedRoot, fullOutput))
            throw new InvalidOperationException("The Event purge test evidence path must remain inside the approved test output root.");

        return new EventInstancePurge(connectionString, new Options(
            mode,
            fullOutput,
            LocalResetServer,
            connection.InitialCatalog,
            $"local-test://{LocalResetServer}/{connection.InitialCatalog}",
            "event-purge-integration-test",
            "event-purge-integration-test-epoch",
            ValidateResetRunId(resetRunId),
            irreversibleNoRecovery ? NoRecoveryReference : "local-test://verified-backup",
            IrreversibleNoRecovery: irreversibleNoRecovery,
            IsProduction: false,
            WriteFreezeConfirmed: true,
            BackupVerified: true,
            VerifiedBackupConnectionString: null,
            expectedFingerprint,
            FileBackupReceiptPath: null,
            FileDeleteReceiptPath: null,
            IsIntegrationTest: true));
    }

    internal static async Task<string> InspectReviewedSchemaProfileAsync(
        SqlConnection connection,
        CancellationToken cancellationToken = default)
    {
        var metadata = await ReadMetadataAsync(connection, null, cancellationToken);
        return ValidateKnownSchema(metadata);
    }

    internal async Task RunAsync(CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(_options.OutputDirectory);
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await ValidateTargetAsync(connection, null, cancellationToken);

        switch (_options.Mode)
        {
            case PurgeMode.Preview:
                await PreviewAsync(connection, cancellationToken);
                return;
            case PurgeMode.Apply:
                await ApplyAsync(connection, cancellationToken);
                return;
            case PurgeMode.Verify:
                await VerifyAsync(connection, cancellationToken);
                return;
            default:
                throw new UnreachableException();
        }
    }

    private async Task PreviewAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        var manifest = await BuildManifestAsync(connection, null, cancellationToken);
        await ValidateProductionBackupAsync(manifest, cancellationToken);
        await WriteEvidenceAsync("preview.json", manifest, cancellationToken);
        await WriteEvidenceAsync("file-manifest.json", new FileManifest(
            _options.ResetRunId,
            manifest.FileManifestHash,
            manifest.Files.Where(file => file.Disposition == "delete-after-sql").ToArray()), cancellationToken);
        Console.WriteLine(
            "Event purge preview complete: " +
            $"eventRoots={manifest.EventIds.Count}; rows={manifest.DeleteCounts.Values.Sum()}; " +
            $"files={manifest.Files.Count}; schema={manifest.SchemaHash}; fingerprint={manifest.Fingerprint}.");
    }

    private async Task ApplyAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        var previewPath = Path.Combine(_options.OutputDirectory, "preview.json");
        if (!File.Exists(previewPath))
            throw new InvalidOperationException("Apply requires the approved preview.json evidence in the output directory.");
        var preview = JsonSerializer.Deserialize<Manifest>(await File.ReadAllTextAsync(previewPath, cancellationToken), _json)
            ?? throw new InvalidOperationException("The preview evidence is invalid.");
        ValidateApprovedManifestContext(preview);
        if (!FixedTimeEquals(preview.Fingerprint, _options.ExpectedFingerprint!))
            throw new InvalidOperationException("The manually approved fingerprint does not match preview.json.");

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            await AcquireApplicationLockAsync(connection, transaction, cancellationToken);
            await ValidateTargetAsync(connection, transaction, cancellationToken);
            var manifest = await BuildManifestAsync(connection, transaction, cancellationToken, preview.Files);
            if (_options.IrreversibleNoRecovery &&
                manifest.Files.Any(file => file.Disposition == "delete-after-sql"))
                throw new InvalidOperationException(
                    "Irreversible Event purge cannot commit SQL while exclusive Event files lack a verified exact-key no-recovery deletion path.");
            if (!FixedTimeEquals(manifest.Fingerprint, _options.ExpectedFingerprint!))
            {
                if (manifest.DeleteCounts.Values.Any(count => count != 0))
                    throw new InvalidOperationException(
                        $"The live fingerprint {manifest.Fingerprint} does not match the approved fingerprint. No rows were changed.");

                await ValidateProductionBackupAsync(preview, cancellationToken);
                var hasPriorApplyReceipt = await ValidatePriorApplyReceiptIfPresentAsync(preview, cancellationToken);
                await ValidateFileAssetStateAfterApplyAsync(connection, transaction, preview.Files, manifest.Files, cancellationToken);
                if (!FixedTimeEquals(preview.SchemaHash, manifest.SchemaHash) ||
                    !preview.Migrations.SequenceEqual(manifest.Migrations, StringComparer.Ordinal) ||
                    !DictionaryEqual(preview.PreservedTableHashes, manifest.PreservedTableHashes) ||
                    !DictionaryEqual(preview.PreservedTableCounts, manifest.PreservedTableCounts))
                    throw new InvalidOperationException("The already-applied reset no longer matches its approved preserved-data evidence.");
                if (!hasPriorApplyReceipt)
                {
                    // SQL may have committed immediately before apply.json was written.
                    // Record that outcome only after proving the approved post-state; the
                    // recoverable mode also proves its exact remote-file backup receipt.
                    if (!_options.IrreversibleNoRecovery)
                        await ValidateFileReceiptAsync(
                            _options.FileBackupReceiptPath,
                            preview,
                            receiptKind: "backup",
                            requiredWhenFilesExist: true,
                            cancellationToken);
                }
                await transaction.CommitAsync(cancellationToken);
                if (!hasPriorApplyReceipt)
                {
                    await WriteEvidenceAsync("apply.json", new ApplyReceipt(
                        ManifestVersion,
                        preview.Fingerprint,
                        preview.FileManifestHash,
                        _options.CodeSha,
                        preview.ToolBuildHash,
                        _options.FreezeEpoch,
                        _options.ResetRunId,
                        _options.TargetResource,
                        _options.BackupReference,
                        _options.IrreversibleNoRecovery,
                        DateTimeOffset.UtcNow,
                        preview.DeleteCounts,
                        RecoveredAfterCommit: true), cancellationToken);
                }
                await WriteEvidenceAsync("r2-delete-manifest.json", new FileManifest(
                    _options.ResetRunId,
                    preview.FileManifestHash,
                    preview.Files.Where(file => file.Disposition == "delete-after-sql").ToArray()), cancellationToken);
                Console.WriteLine("Event purge apply is already complete; SQL no-op evidence verified.");
                return;
            }

            await ValidateProductionBackupAsync(manifest, cancellationToken);

            if (!_options.IrreversibleNoRecovery)
                await ValidateFileReceiptAsync(
                    _options.FileBackupReceiptPath,
                    manifest,
                    receiptKind: "backup",
                    requiredWhenFilesExist: true,
                    cancellationToken);

            var applied = await DeleteAsync(connection, transaction, manifest, cancellationToken);
            foreach (var expected in manifest.DeleteCounts)
            {
                if (!applied.TryGetValue(expected.Key, out var actual) || actual != expected.Value)
                    throw new InvalidOperationException(
                        $"Delete count changed for {expected.Key}: expected {expected.Value}, actual {actual}. Transaction rolled back.");
            }

            await transaction.CommitAsync(cancellationToken);
            await WriteEvidenceAsync("apply.json", new ApplyReceipt(
                ManifestVersion,
                manifest.Fingerprint,
                manifest.FileManifestHash,
                _options.CodeSha,
                manifest.ToolBuildHash,
                _options.FreezeEpoch,
                _options.ResetRunId,
                _options.TargetResource,
                _options.BackupReference,
                _options.IrreversibleNoRecovery,
                DateTimeOffset.UtcNow,
                applied,
                RecoveredAfterCommit: false), cancellationToken);
            await WriteEvidenceAsync("r2-delete-manifest.json", new FileManifest(
                _options.ResetRunId,
                manifest.FileManifestHash,
                manifest.Files.Where(file => file.Disposition == "delete-after-sql").ToArray()), cancellationToken);
            Console.WriteLine(
                $"Event purge applied: rows={applied.Values.Sum()}; fileManifest={manifest.FileManifestHash}; " +
                "remote files remain gated by the exact-key delete receipt.");
        }
        catch
        {
            if (transaction.Connection is not null)
                await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task VerifyAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        var previewPath = Path.Combine(_options.OutputDirectory, "preview.json");
        if (!File.Exists(previewPath))
            throw new InvalidOperationException("Verification requires the approved preview.json evidence in the output directory.");
        var preview = JsonSerializer.Deserialize<Manifest>(await File.ReadAllTextAsync(previewPath, cancellationToken), _json)
            ?? throw new InvalidOperationException("The preview evidence is invalid.");
        ValidateApprovedManifestContext(preview);

        // Shared FileAsset rows are deliberately unlinked during apply. Once unlinked they no
        // longer look Event-scoped, so keep the approved candidate IDs out of both sides of the
        // preserved-data hash and verify their intended post-reset state explicitly below.
        var manifest = await BuildManifestAsync(connection, null, cancellationToken, preview.Files);
        var remaining = manifest.DeleteCounts.Where(pair => pair.Value != 0).ToArray();
        if (remaining.Length != 0)
            throw new InvalidOperationException(
                "Event purge verification found remaining instance rows: " +
                string.Join(", ", remaining.Select(pair => $"{pair.Key}={pair.Value}")));
        await ValidateFileAssetStateAfterApplyAsync(connection, null, preview.Files, manifest.Files, cancellationToken);
        await ValidateProductionBackupAsync(preview, cancellationToken);

        if (!FixedTimeEquals(preview.SchemaHash, manifest.SchemaHash) || !preview.Migrations.SequenceEqual(manifest.Migrations, StringComparer.Ordinal))
            throw new InvalidOperationException("The live schema or migration history changed after the approved preview.");

        if (!DictionaryEqual(preview.PreservedTableHashes, manifest.PreservedTableHashes))
            throw new InvalidOperationException("A preserved non-Event table changed between preview and verification.");
        if (!DictionaryEqual(preview.PreservedTableCounts, manifest.PreservedTableCounts))
            throw new InvalidOperationException("A preserved non-Event row count changed between preview and verification.");

        await ValidateFileReceiptAsync(
            _options.FileDeleteReceiptPath,
            preview,
            receiptKind: "delete",
            requiredWhenFilesExist: true,
            cancellationToken);

        await WriteEvidenceAsync("verify.json", new VerifyReceipt(
            ManifestVersion,
            preview.Fingerprint,
            preview.FileManifestHash,
            _options.CodeSha,
            preview.ToolBuildHash,
            DateTimeOffset.UtcNow,
            manifest.SchemaHash,
            manifest.PreservedTableCounts,
            manifest.PreservedTableHashes), cancellationToken);
        Console.WriteLine(
            $"Event purge verified: instanceRows=0; preservedTables={manifest.PreservedTableHashes.Count}; " +
            $"schema={manifest.SchemaHash}; fileFailures=0.");
    }

    private async Task<Manifest> BuildManifestAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken,
        IReadOnlyList<FileEvidence>? preservedFileExclusions = null)
    {
        var target = await ReadTargetAsync(connection, transaction, cancellationToken);
        var metadata = await ReadMetadataAsync(connection, transaction, cancellationToken);
        if (metadata.TryGetTable("event_activity_plans", out var activityPlanTable) &&
            !activityPlanTable.Columns.ContainsKey("data_json"))
            throw new InvalidOperationException(
                "The retired Event instance purge does not support relational Event activity plans.");
        var schemaProfile = ValidateKnownSchema(metadata, allowLocalSparseColumns: !_options.IsProduction);

        var migrations = await ReadMigrationsAsync(connection, transaction, metadata, cancellationToken);
        var schemaHash = Sha256(JsonSerializer.Serialize(metadata.SchemaFingerprintInput, _json));
        var instanceTables = metadata.Tables.Values
            .Where(table => KnownInstanceTables.Contains(table.Name))
            .OrderBy(table => table.QualifiedName, StringComparer.Ordinal)
            .ToArray();

        var tableEvidence = new SortedDictionary<string, TableEvidence>(StringComparer.Ordinal);
        foreach (var table in instanceTables)
            tableEvidence.Add(table.QualifiedName, await ReadTableEvidenceAsync(connection, transaction, table, cancellationToken));

        await ValidateInstanceReachabilityAsync(connection, transaction, metadata, instanceTables, tableEvidence, cancellationToken);

        await CreatePurgeIdsAsync(connection, transaction, instanceTables, cancellationToken);
        var projects = await ReadProjectIdsAsync(connection, transaction, metadata, cancellationToken);
        await CreateProjectIdsAsync(connection, transaction, projects, cancellationToken);
        ValidateSoftReferenceColumns(metadata, instanceTables);
        await ValidateInboundForeignKeysAsync(connection, transaction, metadata, instanceTables, cancellationToken);
        await ValidateDelegationScopesAsync(connection, transaction, metadata, cancellationToken);

        var files = await ReadFileEvidenceAsync(connection, transaction, metadata, instanceTables, _options.ResetRunId, cancellationToken);
        var exclusiveFileCount = files.Count(file => file.Disposition == "delete-after-sql");
        if (exclusiveFileCount > MaximumRemoteFilesPerReset)
            throw new InvalidOperationException(
                $"The Event reset contains {exclusiveFileCount} exclusive remote files, above the protected exact-manifest limit of {MaximumRemoteFilesPerReset}. " +
                "No reset operation was performed; split support must be reviewed before proceeding.");
        await CreateCandidateFileIdsAsync(connection, transaction, files, preservedFileExclusions, cancellationToken);
        await ValidateUnknownSoftReferencesAsync(connection, transaction, metadata, instanceTables, cancellationToken);

        var auditIds = await ReadSoftReferenceIdsAsync(connection, transaction, metadata, "audit_logs", AuditPredicate, cancellationToken);
        var notificationIds = await ReadSoftReferenceIdsAsync(connection, transaction, metadata, "notification_messages", NotificationPredicate, cancellationToken);
        var delegationIds = await ReadDelegationIdsAsync(connection, transaction, metadata, cancellationToken);
        var idempotencyIds = await ReadWholeTableIdsAsync(connection, transaction, metadata, "event_idempotency_records", cancellationToken);

        var deleteCounts = new SortedDictionary<string, long>(StringComparer.Ordinal);
        foreach (var pair in tableEvidence)
            deleteCounts[pair.Key] = pair.Value.Count;
        if (metadata.TryGetTable("audit_logs", out _)) deleteCounts["dbo.audit_logs"] = auditIds.Count;
        if (metadata.TryGetTable("notification_messages", out _)) deleteCounts["dbo.notification_messages"] = notificationIds.Count;
        if (metadata.TryGetTable("event_package_approval_delegations", out _)) deleteCounts["dbo.event_package_approval_delegations"] = delegationIds.Count;
        if (metadata.TryGetTable("event_idempotency_records", out _)) deleteCounts["dbo.event_idempotency_records"] = idempotencyIds.Count;
        if (metadata.TryGetTable("file_assets", out _)) deleteCounts["dbo.file_assets"] = files.LongCount(file => file.Disposition == "delete-after-sql");

        var preservedCounts = new SortedDictionary<string, long>(StringComparer.Ordinal);
        var preservedHashes = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var table in metadata.Tables.Values.OrderBy(table => table.QualifiedName, StringComparer.Ordinal))
        {
            if (instanceTables.Contains(table) ||
                table.Name.Equals("event_idempotency_records", StringComparison.OrdinalIgnoreCase))
                continue;

            var filter = table.Name.ToLowerInvariant() switch
            {
                // Do not negate the nullable soft-reference predicate directly. SQL's
                // three-valued logic would turn rows with null JSON/reference columns into
                // UNKNOWN and incorrectly omit them from the preserved-data proof.
                "audit_logs" => $"[id] NOT IN (SELECT [id] FROM {Qualified(table)} WHERE {AuditPredicate})",
                "notification_messages" => $"[id] NOT IN (SELECT [id] FROM {Qualified(table)} WHERE {NotificationPredicate})",
                "event_package_approval_delegations" => "[scope_type] = 0",
                "file_assets" => "[id] NOT IN (SELECT [id] FROM #event_file_ids)",
                _ => null
            };
            var (count, hash) = await HashTableAsync(connection, transaction, table, filter, cancellationToken);
            preservedCounts[table.QualifiedName] = count;
            preservedHashes[table.QualifiedName] = hash;
        }

        var eventIds = tableEvidence
            .Where(pair => pair.Key.EndsWith(".group_events", StringComparison.OrdinalIgnoreCase))
            .SelectMany(pair => pair.Value.PrimaryKeys)
            .ToArray();
        var fileManifestHash = CalculateFileManifestHash(files);

        var unsigned = new Manifest(
            ManifestVersion,
            DateTimeOffset.UtcNow,
            target,
            _options.TargetResource,
            _options.CodeSha,
            CalculateToolBuildHash(),
            _options.FreezeEpoch,
            _options.ResetRunId,
            _options.BackupReference,
            _options.IrreversibleNoRecovery,
            schemaHash,
            schemaProfile,
            migrations,
            eventIds,
            projects,
            tableEvidence,
            auditIds,
            notificationIds,
            delegationIds,
            idempotencyIds,
            files,
            fileManifestHash,
            deleteCounts,
            preservedCounts,
            preservedHashes,
            "");
        return unsigned with { Fingerprint = CalculateFingerprint(unsigned) };
    }

    private async Task<SortedDictionary<string, long>> DeleteAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        Manifest manifest,
        CancellationToken cancellationToken)
    {
        var metadata = await ReadMetadataAsync(connection, transaction, cancellationToken);
        var targets = metadata.Tables.Values.Where(table => KnownInstanceTables.Contains(table.Name)).ToArray();
        var result = new SortedDictionary<string, long>(StringComparer.Ordinal);

        result["dbo.audit_logs"] = await ExecuteDeleteAsync(connection, transaction, metadata, "audit_logs", AuditPredicate, cancellationToken);
        result["dbo.notification_messages"] = await ExecuteDeleteAsync(connection, transaction, metadata, "notification_messages", NotificationPredicate, cancellationToken);
        result["dbo.event_package_approval_delegations"] = await ExecuteDeleteAsync(
            connection, transaction, metadata, "event_package_approval_delegations", "[scope_type] IN (1, 2)", cancellationToken);
        result["dbo.event_idempotency_records"] = await ExecuteDeleteAsync(
            connection, transaction, metadata, "event_idempotency_records", null, cancellationToken);

        var ignoredEdges = await NullInternalNullableForeignKeysAsync(connection, transaction, metadata, targets, cancellationToken);
        foreach (var table in OrderForDelete(metadata, targets, ignoredEdges))
            result[table.QualifiedName] = await ExecuteDeleteAsync(connection, transaction, table, null, cancellationToken);

        if (metadata.TryGetTable("file_assets", out var fileAssets))
        {
            await ExecuteNonQueryAsync(connection, transaction,
                "UPDATE [dbo].[file_assets] SET [related_entity_type] = NULL, [related_entity_id] = NULL " +
                "WHERE [id] IN (SELECT [id] FROM #event_file_ids " +
                "WHERE [disposition] = N'unlink-only' AND [clear_related_entity] = 1)", cancellationToken);
            result[fileAssets.QualifiedName] = await ExecuteDeleteAsync(connection, transaction, fileAssets,
                "[id] IN (SELECT [id] FROM #event_file_ids WHERE [disposition] = N'delete-after-sql')", cancellationToken);
        }

        return result;
    }

    private static IReadOnlyList<TableInfo> OrderForDelete(
        DatabaseMetadata metadata,
        IReadOnlyCollection<TableInfo> targetTables,
        IReadOnlySet<string> ignoredEdges)
    {
        var names = targetTables.Select(table => table.QualifiedName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var remaining = names.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var ordered = new List<TableInfo>();
        while (remaining.Count != 0)
        {
            var leaf = remaining.OrderBy(name => name, StringComparer.Ordinal).FirstOrDefault(candidate =>
                !metadata.ForeignKeys.Any(foreignKey =>
                    !ignoredEdges.Contains(foreignKey.Name) &&
                    remaining.Contains(foreignKey.DependentTable) &&
                    remaining.Contains(foreignKey.PrincipalTable) &&
                    foreignKey.PrincipalTable.Equals(candidate, StringComparison.OrdinalIgnoreCase) &&
                    !foreignKey.DependentTable.Equals(candidate, StringComparison.OrdinalIgnoreCase)));
            if (leaf is null)
                throw new InvalidOperationException(
                    "The live Event foreign-key graph contains a non-nullable cycle. No rows were deleted.");
            ordered.Add(metadata.Tables[leaf]);
            remaining.Remove(leaf);
        }
        return ordered;
    }

    private static async Task<HashSet<string>> NullInternalNullableForeignKeysAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        DatabaseMetadata metadata,
        IReadOnlyCollection<TableInfo> targetTables,
        CancellationToken cancellationToken)
    {
        var names = targetTables.Select(table => table.QualifiedName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var ignored = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var foreignKey in metadata.ForeignKeys.Where(foreignKey =>
                     names.Contains(foreignKey.DependentTable) && names.Contains(foreignKey.PrincipalTable)))
        {
            var dependent = metadata.Tables[foreignKey.DependentTable];
            if (!foreignKey.DependentColumns.All(column => dependent.Columns[column].IsNullable))
                continue;
            var assignments = string.Join(", ", foreignKey.DependentColumns.Select(column => $"{Quote(column)} = NULL"));
            var predicate = string.Join(" OR ", foreignKey.DependentColumns.Select(column => $"{Quote(column)} IS NOT NULL"));
            await ExecuteNonQueryAsync(connection, transaction,
                $"UPDATE {Qualified(dependent)} SET {assignments} WHERE {predicate}", cancellationToken);
            ignored.Add(foreignKey.Name);
        }
        return ignored;
    }

    private static async Task AcquireApplicationLockAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock
                @Resource = N'Alife.Event2.Reset',
                @LockMode = N'Exclusive',
                @LockOwner = N'Transaction',
                @LockTimeout = 60000;
            IF @result < 0 THROW 51000, 'Could not acquire the Event reset application lock.', 1;
            """;
        await ExecuteNonQueryAsync(connection, transaction, sql, cancellationToken);
    }

    private async Task ValidateTargetAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken)
    {
        var target = await ReadTargetAsync(connection, transaction, cancellationToken);
        if (!ServerEquals(connection.DataSource, _options.ExpectedServer) ||
            !string.Equals(target.Database, _options.ExpectedDatabase, StringComparison.Ordinal))
            throw new InvalidOperationException(
                $"Target mismatch. Connected endpoint/database is {connection.DataSource}/{target.Database}; " +
                "the explicit expected target differs.");
        if (string.Equals(target.Database, "master", StringComparison.OrdinalIgnoreCase) || target.IsReadOnly)
            throw new InvalidOperationException("The Event reset target is not a writable application database.");
        if (_options.IsProduction)
        {
            var sourceResource = ParseAzureSqlResourceId(_options.TargetResource, "Events:TargetResource");
            if (!AzureServerResourceEquals(target.ConnectionEndpoint, sourceResource.Server) ||
                !string.Equals(target.Database, sourceResource.Database, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("The production SQL connection is not the exact Azure SQL resource named by Events:TargetResource.");
        }
        else if (_options.IsIntegrationTest)
        {
            if (!string.Equals(connection.DataSource, LocalResetServer, StringComparison.OrdinalIgnoreCase) ||
                !target.Database.StartsWith("AlifeEventPurgeTest_", StringComparison.Ordinal) ||
                !string.Equals(_options.TargetResource, $"local-test://{LocalResetServer}/{target.Database}", StringComparison.Ordinal))
                throw new InvalidOperationException("The Event purge integration test escaped its disposable localhost target.");
        }
        else if (!string.Equals(connection.DataSource, LocalResetServer, StringComparison.OrdinalIgnoreCase) ||
                 !string.Equals(target.Database, LocalResetDatabase, StringComparison.Ordinal) ||
                 !string.Equals(_options.TargetResource, LocalResetResource, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Local Event purge connected outside the approved localhost,14333/alife_db target.");
        }
    }

    private static async Task<TargetIdentity> ReadTargetAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken)
    {
        await using var command = Command(connection, transaction, """
            SELECT
                CONVERT(nvarchar(256), SERVERPROPERTY('ServerName')),
                DB_NAME(),
                CONVERT(bit, CASE WHEN DATABASEPROPERTYEX(DB_NAME(), 'Updateability') = N'READ_ONLY' THEN 1 ELSE 0 END),
                CONVERT(nvarchar(60), SERVERPROPERTY('ProductVersion')),
                CONVERT(nvarchar(60), SERVERPROPERTY('EngineEdition'));
            """);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("Could not read SQL target identity.");
        return new TargetIdentity(
            connection.DataSource, reader.GetString(0), reader.GetString(1), reader.GetBoolean(2), reader.GetString(3), reader.GetString(4));
    }

    private static async Task<DatabaseMetadata> ReadMetadataAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken)
    {
        const string columnsSql = """
            SELECT s.name, t.name, c.name, ty.name, c.max_length, c.precision, c.scale,
                   c.is_nullable, c.column_id,
                   CASE WHEN pk.column_id IS NULL THEN 0 ELSE 1 END AS is_pk,
                   ISNULL(pk.key_ordinal, 0)
            FROM sys.tables t
            JOIN sys.schemas s ON s.schema_id = t.schema_id
            JOIN sys.columns c ON c.object_id = t.object_id
            JOIN sys.types ty ON ty.user_type_id = c.user_type_id
            LEFT JOIN (
                SELECT ic.object_id, ic.column_id, ic.key_ordinal
                FROM sys.indexes i
                JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                WHERE i.is_primary_key = 1
            ) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id
            WHERE t.is_ms_shipped = 0
            ORDER BY s.name, t.name, c.column_id;
            """;
        var tableBuilders = new Dictionary<string, List<ColumnInfo>>(StringComparer.OrdinalIgnoreCase);
        await using (var command = Command(connection, transaction, columnsSql))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                var schema = reader.GetString(0);
                var table = reader.GetString(1);
                var qualified = schema + "." + table;
                if (!tableBuilders.TryGetValue(qualified, out var columns))
                    tableBuilders[qualified] = columns = new List<ColumnInfo>();
                columns.Add(new ColumnInfo(
                    reader.GetString(2), reader.GetString(3), reader.GetInt16(4), reader.GetByte(5), reader.GetByte(6),
                    reader.GetBoolean(7), reader.GetInt32(8), reader.GetInt32(9) == 1,
                    Convert.ToInt32(reader.GetValue(10), CultureInfo.InvariantCulture)));
            }
        }

        var tables = tableBuilders.ToDictionary(
            pair => pair.Key,
            pair =>
            {
                var split = pair.Key.Split('.', 2);
                return new TableInfo(
                    split[0], split[1],
                    pair.Value.ToDictionary(column => column.Name, StringComparer.OrdinalIgnoreCase),
                    pair.Value.Where(column => column.IsPrimaryKey).OrderBy(column => column.PrimaryKeyOrdinal).Select(column => column.Name).ToArray());
            },
            StringComparer.OrdinalIgnoreCase);

        const string foreignKeysSql = """
            SELECT fk.name,
                   ds.name + N'.' + dt.name,
                   ps.name + N'.' + pt.name,
                   dc.name,
                   pc.name,
                   fkc.constraint_column_id,
                   fk.is_disabled,
                   fk.is_not_trusted
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            JOIN sys.tables dt ON dt.object_id = fk.parent_object_id
            JOIN sys.schemas ds ON ds.schema_id = dt.schema_id
            JOIN sys.columns dc ON dc.object_id = dt.object_id AND dc.column_id = fkc.parent_column_id
            JOIN sys.tables pt ON pt.object_id = fk.referenced_object_id
            JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
            JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.referenced_column_id
            ORDER BY fk.name, fkc.constraint_column_id;
            """;
        var fkRows = new List<(string Name, string Dependent, string Principal, string DependentColumn, string PrincipalColumn, int Ordinal, bool IsDisabled, bool IsNotTrusted)>();
        await using (var command = Command(connection, transaction, foreignKeysSql))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
                fkRows.Add((reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetInt32(5), reader.GetBoolean(6), reader.GetBoolean(7)));
        }
        var foreignKeys = fkRows.GroupBy(row => (row.Name, row.Dependent, row.Principal))
            .Select(group => new ForeignKeyInfo(
                group.Key.Name,
                group.Key.Dependent,
                group.Key.Principal,
                group.OrderBy(row => row.Ordinal).Select(row => row.DependentColumn).ToArray(),
                group.OrderBy(row => row.Ordinal).Select(row => row.PrincipalColumn).ToArray(),
                group.Any(row => row.IsDisabled),
                group.Any(row => row.IsNotTrusted)))
            .OrderBy(foreignKey => foreignKey.Name, StringComparer.Ordinal)
            .ToArray();
        return new DatabaseMetadata(tables, foreignKeys);
    }

    private static string ValidateKnownSchema(DatabaseMetadata metadata, bool allowLocalSparseColumns = false)
    {
        if (!metadata.TryGetTable("group_events", out _))
            throw new InvalidOperationException("The target does not contain dbo.group_events.");

        var unknown = metadata.Tables.Values
            .Where(table => table.Name.StartsWith("event_", StringComparison.OrdinalIgnoreCase) ||
                            table.Name.Equals("group_events", StringComparison.OrdinalIgnoreCase))
            .Where(table => !KnownInstanceTables.Contains(table.Name) &&
                            !PreservedEventTables.Contains(table.Name) &&
                            !SpecialEventTables.Contains(table.Name))
            .Select(table => table.QualifiedName)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();
        if (unknown.Length != 0)
            throw new InvalidOperationException(
                "Unknown Event tables were found; update and review the purge allowlist before proceeding: " + string.Join(", ", unknown));

        var nonDbo = metadata.Tables.Values
            .Where(table => (KnownInstanceTables.Contains(table.Name) || PreservedEventTables.Contains(table.Name) || SpecialEventTables.Contains(table.Name)) &&
                            !table.Schema.Equals("dbo", StringComparison.OrdinalIgnoreCase))
            .Select(table => table.QualifiedName)
            .ToArray();
        if (nonDbo.Length != 0)
            throw new InvalidOperationException("Event tables outside dbo are not supported: " + string.Join(", ", nonDbo));

        return MatchReviewedSchemaProfile(metadata, allowLocalSparseColumns);
    }

    private static void ValidateSoftReferenceColumns(DatabaseMetadata metadata, IReadOnlyCollection<TableInfo> instanceTables)
    {
        var instanceNames = instanceTables.Select(table => table.QualifiedName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var unknown = metadata.Tables.Values
            .Where(table => !instanceNames.Contains(table.QualifiedName) &&
                            !PreservedEventTables.Contains(table.Name) &&
                            !SpecialEventTables.Contains(table.Name) &&
                            !KnownSoftReferenceTables.Contains(table.Name))
            .SelectMany(table => table.Columns.Values
                .Where(column => EventReferenceColumnNames.Contains(column.Name))
                .Select(column => $"{table.QualifiedName}.{column.Name}"))
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
        if (unknown.Length != 0)
            throw new InvalidOperationException(
                "Unknown Event soft-reference columns were found: " + string.Join(", ", unknown));
    }

    private static async Task ValidateInboundForeignKeysAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        IReadOnlyCollection<TableInfo> instanceTables,
        CancellationToken cancellationToken)
    {
        var targets = instanceTables.Select(table => table.QualifiedName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var permittedDependents = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "dbo.audit_logs", "dbo.notification_messages" };
        var inbound = metadata.ForeignKeys.Where(foreignKey =>
                targets.Contains(foreignKey.PrincipalTable) &&
                !targets.Contains(foreignKey.DependentTable) &&
                !permittedDependents.Contains(foreignKey.DependentTable))
            .ToArray();
        if (inbound.Length == 0)
            return;
        throw new InvalidOperationException(
            "Unclassified foreign keys point at Event instances: " +
            string.Join(", ", inbound.Select(foreignKey => foreignKey.Name).OrderBy(name => name, StringComparer.Ordinal)));
    }

    private static async Task ValidateInstanceReachabilityAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        IReadOnlyCollection<TableInfo> instanceTables,
        IReadOnlyDictionary<string, TableEvidence> evidence,
        CancellationToken cancellationToken)
    {
        const string root = "dbo.group_events";
        var instanceNames = instanceTables.Select(table => table.QualifiedName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var unsafeForeignKeys = metadata.ForeignKeys
            .Where(foreignKey => instanceNames.Contains(foreignKey.DependentTable) &&
                                 instanceNames.Contains(foreignKey.PrincipalTable) &&
                                 (foreignKey.IsDisabled || foreignKey.IsNotTrusted))
            .Select(foreignKey => foreignKey.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();
        if (unsafeForeignKeys.Length != 0)
            throw new InvalidOperationException(
                "Disabled or untrusted foreign keys exist inside the Event instance graph: " + string.Join(", ", unsafeForeignKeys));

        foreach (var table in instanceTables.OrderBy(table => table.QualifiedName, StringComparer.Ordinal))
        {
            if (table.QualifiedName.Equals(root, StringComparison.OrdinalIgnoreCase) ||
                evidence[table.QualifiedName].Count == 0)
                continue;

            var paths = FindRootPaths(metadata.ForeignKeys, instanceNames, table.QualifiedName, root, maximumPaths: 64);
            if (paths.Count == 0)
                throw new InvalidOperationException(
                    $"Event instance table {table.QualifiedName} contains rows but has no reviewed foreign-key path to dbo.group_events.");

            var reachable = paths.Select((path, index) => BuildReachabilityExists(path, index)).ToArray();
            var sql = $"SELECT COUNT_BIG(*) FROM {Qualified(table)} t0 WHERE NOT ({string.Join(" OR ", reachable)});";
            var orphanCount = await ExecuteScalarInt64Async(connection, transaction, sql, cancellationToken);
            if (orphanCount != 0)
                throw new InvalidOperationException(
                    $"Event instance table {table.QualifiedName} contains {orphanCount} row(s) that cannot be traced to a current Event root.");
        }
    }

    private static IReadOnlyList<IReadOnlyList<TraversalEdge>> FindRootPaths(
        IReadOnlyList<ForeignKeyInfo> foreignKeys,
        IReadOnlySet<string> instanceNames,
        string start,
        string root,
        int maximumPaths)
    {
        var results = new List<IReadOnlyList<TraversalEdge>>();
        var queue = new Queue<(string Table, IReadOnlyList<TraversalEdge> Path, IReadOnlySet<string> Visited)>();
        queue.Enqueue((start, Array.Empty<TraversalEdge>(), new HashSet<string>(StringComparer.OrdinalIgnoreCase) { start }));
        while (queue.Count != 0 && results.Count < maximumPaths)
        {
            var current = queue.Dequeue();
            foreach (var foreignKey in foreignKeys.Where(foreignKey =>
                         !foreignKey.IsDisabled && !foreignKey.IsNotTrusted &&
                         instanceNames.Contains(foreignKey.DependentTable) && instanceNames.Contains(foreignKey.PrincipalTable) &&
                         (foreignKey.DependentTable.Equals(current.Table, StringComparison.OrdinalIgnoreCase) ||
                          foreignKey.PrincipalTable.Equals(current.Table, StringComparison.OrdinalIgnoreCase))))
            {
                var currentIsDependent = foreignKey.DependentTable.Equals(current.Table, StringComparison.OrdinalIgnoreCase);
                var next = currentIsDependent ? foreignKey.PrincipalTable : foreignKey.DependentTable;
                if (next.Equals(current.Table, StringComparison.OrdinalIgnoreCase) || current.Visited.Contains(next))
                    continue;
                var nextPath = current.Path.Append(new TraversalEdge(foreignKey, currentIsDependent)).ToArray();
                if (next.Equals(root, StringComparison.OrdinalIgnoreCase))
                {
                    results.Add(nextPath);
                    continue;
                }
                if (nextPath.Length >= instanceNames.Count)
                    continue;
                queue.Enqueue((next, nextPath, new HashSet<string>(current.Visited, StringComparer.OrdinalIgnoreCase) { next }));
            }
        }
        return results;
    }

    private static string BuildReachabilityExists(IReadOnlyList<TraversalEdge> path, int pathIndex)
    {
        var sql = new StringBuilder("EXISTS (SELECT 1 FROM ");
        string? sourceJoin = null;
        for (var index = 0; index < path.Count; index++)
        {
            var edge = path[index];
            var nextTable = edge.CurrentIsDependent ? edge.ForeignKey.PrincipalTable : edge.ForeignKey.DependentTable;
            var next = nextTable.Split('.', 2);
            var nextAlias = $"p{pathIndex}_{index + 1}";
            if (index == 0)
            {
                sql.Append(Quote(next[0])).Append('.').Append(Quote(next[1])).Append(' ').Append(nextAlias);
            }
            else
            {
                sql.Append(" JOIN ").Append(Quote(next[0])).Append('.').Append(Quote(next[1])).Append(' ').Append(nextAlias)
                    .Append(" ON ");
            }

            var currentAlias = index == 0 ? "t0" : $"p{pathIndex}_{index}";
            var comparisons = edge.CurrentIsDependent
                ? edge.ForeignKey.DependentColumns.Zip(edge.ForeignKey.PrincipalColumns,
                    (dependent, principal) => $"{currentAlias}.{Quote(dependent)} = {nextAlias}.{Quote(principal)}")
                : edge.ForeignKey.DependentColumns.Zip(edge.ForeignKey.PrincipalColumns,
                    (dependent, principal) => $"{nextAlias}.{Quote(dependent)} = {currentAlias}.{Quote(principal)}");
            var comparison = string.Join(" AND ", comparisons);
            if (index == 0)
                sourceJoin = comparison;
            else
                sql.Append(comparison);
        }
        return sql.Append(" WHERE ").Append(sourceJoin).Append(')').ToString();
    }

    private static async Task ValidateDelegationScopesAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        CancellationToken cancellationToken)
    {
        if (!metadata.TryGetTable("event_package_approval_delegations", out _))
            return;
        var occurrenceCheck = metadata.TryGetTable("event_composition_occurrences", out _)
            ? "d.[scope_type] = 2 AND NOT EXISTS (SELECT 1 FROM [dbo].[event_composition_occurrences] o WHERE o.[id] = d.[scope_id])"
            : "d.[scope_type] = 2";
        var sql = $"""
            SELECT COUNT_BIG(*)
            FROM [dbo].[event_package_approval_delegations] d
            WHERE (d.[scope_type] = 1 AND NOT EXISTS (
                       SELECT 1 FROM [dbo].[group_events] e WHERE e.[id] = d.[scope_id]))
               OR ({occurrenceCheck})
               OR d.[scope_type] NOT IN (0, 1, 2)
               OR (d.[scope_type] = 0 AND d.[scope_id] IS NOT NULL)
               OR (d.[scope_type] IN (1, 2) AND d.[scope_id] IS NULL);
            """;
        var invalid = await ExecuteScalarInt64Async(connection, transaction, sql, cancellationToken);
        if (invalid != 0)
            throw new InvalidOperationException($"Found {invalid} malformed or orphaned Event approval delegations.");
    }

    private static async Task ValidateUnknownSoftReferencesAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        IReadOnlyCollection<TableInfo> instanceTables,
        CancellationToken cancellationToken)
    {
        var hasInstanceIds = await ExecuteScalarInt64Async(
            connection, transaction, "SELECT CASE WHEN EXISTS (SELECT 1 FROM #purge_ids) THEN 1 ELSE 0 END", cancellationToken) != 0;
        var hasFileIds = await ExecuteScalarInt64Async(
            connection, transaction, "SELECT CASE WHEN EXISTS (SELECT 1 FROM #event_file_ids) THEN 1 ELSE 0 END", cancellationToken) != 0;
        var hasProjectIds = await ExecuteScalarInt64Async(
            connection, transaction, "SELECT CASE WHEN EXISTS (SELECT 1 FROM #purge_activity_ids) THEN 1 ELSE 0 END", cancellationToken) != 0;
        if (!hasInstanceIds && !hasFileIds && !hasProjectIds)
            return;
        var instanceNames = instanceTables.Select(table => table.QualifiedName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var classifiedFileReferenceColumns = metadata.ForeignKeys
            .Where(foreignKey => foreignKey.PrincipalTable.Equals("dbo.file_assets", StringComparison.OrdinalIgnoreCase))
            .SelectMany(foreignKey => foreignKey.DependentColumns.Select(column => foreignKey.DependentTable + "." + column))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var hits = new List<string>();
        foreach (var table in metadata.Tables.Values.OrderBy(table => table.QualifiedName, StringComparer.Ordinal))
        {
            if (instanceNames.Contains(table.QualifiedName) || KnownSoftReferenceTables.Contains(table.Name) ||
                table.Name.Equals("event_package_approval_delegations", StringComparison.OrdinalIgnoreCase) ||
                table.Name.Equals("event_idempotency_records", StringComparison.OrdinalIgnoreCase))
                continue;
            foreach (var column in table.Columns.Values.OrderBy(column => column.Ordinal))
            {
                string? sql = null;
                var isClassifiedFileReference = classifiedFileReferenceColumns.Contains(table.QualifiedName + "." + column.Name);
                if (column.TypeName.Equals("uniqueidentifier", StringComparison.OrdinalIgnoreCase))
                {
                    var instanceClause = hasInstanceIds
                        ? $"EXISTS (SELECT 1 FROM {Qualified(table)} t JOIN #purge_ids p ON t.{Quote(column.Name)} = p.[id])"
                        : "1 = 0";
                    var fileClause = hasFileIds && !isClassifiedFileReference
                        ? $"EXISTS (SELECT 1 FROM {Qualified(table)} t JOIN #event_file_ids f ON t.{Quote(column.Name)} = f.[id])"
                        : "1 = 0";
                    sql = $"SELECT CASE WHEN {instanceClause} OR {fileClause} THEN 1 ELSE 0 END";
                }
                else if (IsReferenceScannableTextType(column.TypeName))
                {
                    var value = $"LOWER(CONVERT(nvarchar(max), t.{Quote(column.Name)}))";
                    var instanceClause = hasInstanceIds
                        ? $"EXISTS (SELECT 1 FROM {Qualified(table)} t CROSS JOIN #purge_ids p " +
                          $"WHERE CHARINDEX(CONVERT(nvarchar(36), p.[id]), {value}) > 0)"
                        : "1 = 0";
                    var fileClause = hasFileIds && !isClassifiedFileReference
                        ? $"EXISTS (SELECT 1 FROM {Qualified(table)} t CROSS JOIN #event_file_ids f " +
                          $"WHERE CHARINDEX(CONVERT(nvarchar(36), f.[id]), {value}) > 0)"
                        : "1 = 0";
                    var projectClause = hasProjectIds
                        ? $"EXISTS (SELECT 1 FROM {Qualified(table)} t CROSS JOIN #purge_activity_ids p " +
                          $"WHERE CHARINDEX(CONVERT(nvarchar(36), p.[event_id]), {value}) > 0 " +
                          $"AND CHARINDEX(LOWER(p.[activity_id]), {value}) > 0)"
                        : "1 = 0";
                    sql = $"SELECT CASE WHEN {instanceClause} OR {fileClause} OR {projectClause} THEN 1 ELSE 0 END";
                }

                if (sql is null)
                    continue;
                if (await ExecuteScalarInt64Async(connection, transaction, sql, cancellationToken) != 0)
                    hits.Add($"{table.QualifiedName}.{column.Name}");
            }
        }
        if (hits.Count != 0)
            throw new InvalidOperationException(
                "Unclassified soft references to Event instances or Event file assets were found: " + string.Join(", ", hits));
    }

    internal static bool IsReferenceScannableTextType(string typeName) => typeName.ToLowerInvariant() switch
    {
        "nvarchar" or "varchar" or "nchar" or "char" or "ntext" or "text" => true,
        _ => false
    };

    private static async Task CreatePurgeIdsAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        IReadOnlyCollection<TableInfo> instanceTables,
        CancellationToken cancellationToken)
    {
        await ExecuteNonQueryAsync(connection, transaction,
            "IF OBJECT_ID('tempdb..#purge_ids') IS NOT NULL DROP TABLE #purge_ids; " +
            "CREATE TABLE #purge_ids ([id] uniqueidentifier NOT NULL PRIMARY KEY);", cancellationToken);
        foreach (var table in instanceTables)
        {
            foreach (var primaryKey in table.PrimaryKeyColumns.Where(column =>
                         table.Columns[column].TypeName.Equals("uniqueidentifier", StringComparison.OrdinalIgnoreCase)))
            {
                await ExecuteNonQueryAsync(connection, transaction,
                    $"INSERT INTO #purge_ids ([id]) SELECT DISTINCT {Quote(primaryKey)} FROM {Qualified(table)} " +
                    $"WHERE {Quote(primaryKey)} IS NOT NULL AND NOT EXISTS " +
                    $"(SELECT 1 FROM #purge_ids p WHERE p.[id] = {Qualified(table)}.{Quote(primaryKey)});", cancellationToken);
            }
        }
    }

    private static async Task<IReadOnlyList<ProjectIdEvidence>> ReadProjectIdsAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        CancellationToken cancellationToken)
    {
        if (!metadata.TryGetTable("event_activity_plans", out var planTable))
            return Array.Empty<ProjectIdEvidence>();
        if (!planTable.Columns.ContainsKey("data_json"))
            throw new InvalidOperationException(
                "The retired Event instance purge does not support relational Event activity plans.");
        var result = new List<ProjectIdEvidence>();
        await using var command = Command(connection, transaction,
            "SELECT [event_id], [data_json] FROM [dbo].[event_activity_plans] ORDER BY [event_id]");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var eventId = reader.GetGuid(0);
            var json = reader.GetString(1);
            JsonObject root;
            try
            {
                root = JsonNode.Parse(json) as JsonObject
                    ?? throw new JsonException("Activity plan root must be an object.");
            }
            catch (JsonException)
            {
                throw new InvalidOperationException(
                    $"An Event activity plan is malformed (count=1; evidence={SensitiveEvidenceHash([eventId.ToString("D")])}).");
            }
            if (root["questionnaireVersion"] is JsonNode questionnaireNode)
            {
                if (questionnaireNode is not JsonValue questionnaireValue ||
                    !questionnaireValue.TryGetValue<int>(out var questionnaireVersion) ||
                    questionnaireVersion is < 1 or > 2)
                    throw new InvalidOperationException(
                        $"An Event activity plan has an unsupported questionnaire version (count=1; evidence={SensitiveEvidenceHash([eventId.ToString("D")])}).");
            }
            if (root["activities"] is not JsonArray activities)
                throw new InvalidOperationException(
                    $"An Event activity plan does not contain an activities array (count=1; evidence={SensitiveEvidenceHash([eventId.ToString("D")])}).");
            if (activities.Count > 10_000)
                throw new InvalidOperationException(
                    $"An Event activity plan exceeds the reset evidence safety limit (count=1; evidence={SensitiveEvidenceHash([eventId.ToString("D")])}).");
            var ids = new HashSet<string>(StringComparer.Ordinal);
            foreach (var node in activities)
            {
                if (node is not JsonObject activity ||
                    activity["id"] is not JsonValue idValue ||
                    !idValue.TryGetValue<string>(out var id) ||
                    string.IsNullOrWhiteSpace(id) || id.Length > 512 || id != id.Trim())
                    throw new InvalidOperationException(
                        $"An Event activity plan contains an invalid project shape (count=1; evidence={SensitiveEvidenceHash([eventId.ToString("D")])}).");
                if (!ids.Add(id))
                    throw new InvalidOperationException(
                        $"An Event activity plan contains a duplicate project id (count=1; evidence={SensitiveEvidenceHash([eventId.ToString("D"), id])}).");
                result.Add(new ProjectIdEvidence(eventId, id));
            }
        }
        return result.OrderBy(project => project.EventId).ThenBy(project => project.ActivityId, StringComparer.Ordinal).ToArray();
    }

    private static async Task CreateProjectIdsAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        IReadOnlyList<ProjectIdEvidence> projects,
        CancellationToken cancellationToken)
    {
        await ExecuteNonQueryAsync(connection, transaction,
            "IF OBJECT_ID('tempdb..#purge_activity_ids') IS NOT NULL DROP TABLE #purge_activity_ids; " +
            "CREATE TABLE #purge_activity_ids ([event_id] uniqueidentifier NOT NULL, [activity_id] nvarchar(512) NOT NULL, " +
            "PRIMARY KEY ([event_id], [activity_id]));", cancellationToken);
        foreach (var project in projects)
        {
            await using var command = Command(connection, transaction,
                "INSERT INTO #purge_activity_ids ([event_id], [activity_id]) VALUES (@eventId, @activityId);");
            command.Parameters.AddWithValue("@eventId", project.EventId);
            command.Parameters.AddWithValue("@activityId", project.ActivityId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task CreateCandidateFileIdsAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        IReadOnlyList<FileEvidence> files,
        IReadOnlyList<FileEvidence>? preservedFileExclusions,
        CancellationToken cancellationToken)
    {
        await ExecuteNonQueryAsync(connection, transaction,
            "IF OBJECT_ID('tempdb..#event_file_ids') IS NOT NULL DROP TABLE #event_file_ids; " +
            "CREATE TABLE #event_file_ids ([id] uniqueidentifier NOT NULL PRIMARY KEY, [disposition] nvarchar(32) NOT NULL, " +
            "[clear_related_entity] bit NOT NULL);", cancellationToken);
        foreach (var file in files.Concat(preservedFileExclusions ?? []).GroupBy(file => file.Id).Select(group => group.First()))
        {
            await using var command = Command(connection, transaction,
                "IF NOT EXISTS (SELECT 1 FROM #event_file_ids WHERE [id] = @id) " +
                "INSERT INTO #event_file_ids ([id], [disposition], [clear_related_entity]) VALUES (@id, @disposition, @clearRelatedEntity);");
            command.Parameters.AddWithValue("@id", file.Id);
            command.Parameters.AddWithValue("@disposition", file.Disposition);
            command.Parameters.AddWithValue("@clearRelatedEntity", file.ClearRelatedEntity);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task ValidateFileAssetStateAfterApplyAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        IReadOnlyList<FileEvidence> approvedFiles,
        IReadOnlyList<FileEvidence> currentCandidates,
        CancellationToken cancellationToken)
    {
        var approvedSharedIds = approvedFiles
            .Where(file => file.Disposition == "unlink-only")
            .Select(file => file.Id)
            .ToHashSet();
        var unexpected = currentCandidates
            .Where(file => file.Disposition != "unlink-only" || !approvedSharedIds.Contains(file.Id))
            .Select(file => file.Id)
            .ToArray();
        if (unexpected.Length != 0)
            throw new InvalidOperationException(
                $"Event file verification found candidates outside the approved shared-file set " +
                $"(count={unexpected.Length}; evidence={SensitiveEvidenceHash(unexpected.Select(id => id.ToString("D")))}).");

        var metadata = await ReadMetadataAsync(connection, transaction, cancellationToken);
        if (!metadata.TryGetTable("file_assets", out var fileAssets))
        {
            if (approvedFiles.Count == 0) return;
            throw new InvalidOperationException("Approved Event file evidence exists but dbo.file_assets is missing.");
        }
        var etagExpression = fileAssets.Columns.ContainsKey("etag")
            ? "[etag]"
            : fileAssets.Columns.ContainsKey("e_tag")
                ? "[e_tag]"
                : "CONVERT(nvarchar(512), NULL)";

        foreach (var expected in approvedFiles)
        {
            await using var command = Command(connection, transaction, $"""
                SELECT [storage_provider], [bucket_name], [object_key], [size_bytes], {etagExpression} AS [event_reset_etag],
                       [related_entity_type], [related_entity_id]
                FROM [dbo].[file_assets]
                WHERE [id] = @id;
                """);
            command.Parameters.AddWithValue("@id", expected.Id);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var exists = await reader.ReadAsync(cancellationToken);
            if (expected.Disposition == "delete-after-sql")
            {
                if (exists)
                    throw new InvalidOperationException(
                        $"An exclusive Event FileAsset still exists after reset (count=1; evidence={SensitiveEvidenceHash([expected.Id.ToString("D")])}).");
                continue;
            }
            if (!exists)
                throw new InvalidOperationException(
                    $"A shared Event FileAsset was deleted during reset (count=1; evidence={SensitiveEvidenceHash([expected.Id.ToString("D")])}).");

            var actualEtag = reader.IsDBNull(4) ? null : reader.GetString(4);
            if (!string.Equals(reader.GetString(0), expected.StorageProvider, StringComparison.Ordinal) ||
                !string.Equals(reader.GetString(1), expected.BucketName, StringComparison.Ordinal) ||
                !string.Equals(reader.GetString(2), expected.ObjectKey, StringComparison.Ordinal) ||
                reader.GetInt64(3) != expected.SizeBytes ||
                !string.Equals(actualEtag, expected.ETag, StringComparison.Ordinal))
                throw new InvalidOperationException(
                    $"A shared Event FileAsset changed outside its approved association (count=1; evidence={SensitiveEvidenceHash([expected.Id.ToString("D")])}).");

            var actualType = reader.IsDBNull(5) ? null : reader.GetString(5);
            var actualId = reader.IsDBNull(6) ? (Guid?)null : reader.GetGuid(6);
            if (expected.ClearRelatedEntity)
            {
                if (actualType is not null || actualId.HasValue)
                    throw new InvalidOperationException(
                        $"A shared Event FileAsset still contains an Event association (count=1; evidence={SensitiveEvidenceHash([expected.Id.ToString("D")])}).");
            }
            else if (!string.Equals(actualType, expected.RelatedEntityType, StringComparison.Ordinal) ||
                     actualId != expected.RelatedEntityId)
            {
                throw new InvalidOperationException(
                    $"A shared Event FileAsset lost a non-Event association (count=1; evidence={SensitiveEvidenceHash([expected.Id.ToString("D")])}).");
            }
        }
    }

    private static async Task<IReadOnlyList<FileEvidence>> ReadFileEvidenceAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        IReadOnlyCollection<TableInfo> instanceTables,
        string resetRunId,
        CancellationToken cancellationToken)
    {
        if (!metadata.TryGetTable("file_assets", out var fileAssets))
            return Array.Empty<FileEvidence>();

        await ExecuteNonQueryAsync(connection, transaction,
            "IF OBJECT_ID('tempdb..#candidate_files') IS NOT NULL DROP TABLE #candidate_files; " +
            "CREATE TABLE #candidate_files ([id] uniqueidentifier NOT NULL PRIMARY KEY);", cancellationToken);
        if (metadata.TryGetTable("event_artifacts", out var artifacts) && artifacts.Columns.ContainsKey("file_asset_id"))
            await ExecuteNonQueryAsync(connection, transaction,
                "INSERT INTO #candidate_files SELECT DISTINCT [file_asset_id] FROM [dbo].[event_artifacts] " +
                "WHERE [file_asset_id] IS NOT NULL;", cancellationToken);
        if (metadata.TryGetTable("event_registration_materials", out var materials) && materials.Columns.ContainsKey("file_asset_id"))
            await ExecuteNonQueryAsync(connection, transaction,
                "INSERT INTO #candidate_files SELECT DISTINCT r.[file_asset_id] FROM [dbo].[event_registration_materials] r " +
                "WHERE r.[file_asset_id] IS NOT NULL AND NOT EXISTS (SELECT 1 FROM #candidate_files c WHERE c.[id] = r.[file_asset_id]);", cancellationToken);

        await ExecuteNonQueryAsync(connection, transaction, """
            INSERT INTO #candidate_files
            SELECT f.[id]
            FROM [dbo].[file_assets] f
            WHERE (
                    (LOWER(ISNULL(f.[related_entity_type], N'')) IN
                        (N'event', N'enrollment', N'review', N'eventregistrationparticipant')
                        AND f.[related_entity_id] IN (SELECT [id] FROM #purge_ids))
                    OR (f.[purpose] = 11 AND f.[object_key] LIKE N'private/event-registration/%')
                  )
              AND NOT EXISTS (SELECT 1 FROM #candidate_files c WHERE c.[id] = f.[id]);
            """, cancellationToken);

        var instanceNames = instanceTables.Select(table => table.QualifiedName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var inboundFileFks = metadata.ForeignKeys.Where(foreignKey =>
                foreignKey.PrincipalTable.Equals("dbo.file_assets", StringComparison.OrdinalIgnoreCase) &&
                !instanceNames.Contains(foreignKey.DependentTable))
            .ToArray();
        var sharedIds = new HashSet<Guid>();
        foreach (var foreignKey in inboundFileFks)
        {
            var dependent = metadata.Tables[foreignKey.DependentTable];
            var joins = foreignKey.DependentColumns.Zip(foreignKey.PrincipalColumns,
                (dependentColumn, principalColumn) => $"d.{Quote(dependentColumn)} = f.{Quote(principalColumn)}");
            var sql = $"SELECT DISTINCT f.[id] FROM {Qualified(dependent)} d JOIN [dbo].[file_assets] f ON {string.Join(" AND ", joins)} " +
                      "JOIN #candidate_files c ON c.[id] = f.[id]";
            await using var command = Command(connection, transaction, sql);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
                sharedIds.Add(reader.GetGuid(0));
        }

        // A second FileAsset row can share the same physical object even in an older schema
        // without the current uniqueness constraint. Never delete that object or either row.
        await using (var command = Command(connection, transaction, """
            SELECT DISTINCT candidate.[id]
            FROM [dbo].[file_assets] candidate
            JOIN #candidate_files c ON c.[id] = candidate.[id]
            JOIN [dbo].[file_assets] other
              ON other.[id] <> candidate.[id]
             AND other.[storage_provider] = candidate.[storage_provider]
             AND other.[bucket_name] = candidate.[bucket_name]
             AND other.[object_key] = candidate.[object_key];
            """))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
                sharedIds.Add(reader.GetGuid(0));
        }

        var etagExpression = fileAssets.Columns.ContainsKey("etag")
            ? "f.[etag]"
            : fileAssets.Columns.ContainsKey("e_tag")
                ? "f.[e_tag]"
                : "CONVERT(nvarchar(512), NULL)";
        var selectSql = $"""
            SELECT f.[id], f.[storage_provider], f.[bucket_name], f.[object_key], f.[size_bytes], {etagExpression},
                   f.[related_entity_type], f.[related_entity_id],
                   CASE WHEN LOWER(ISNULL(f.[related_entity_type], N'')) IN
                        (N'event', N'enrollment', N'review', N'eventregistrationparticipant')
                        AND f.[related_entity_id] IN (SELECT [id] FROM #purge_ids)
                        THEN CONVERT(bit, 1) ELSE CONVERT(bit, 0) END
            FROM [dbo].[file_assets] f
            JOIN #candidate_files c ON c.[id] = f.[id]
            ORDER BY f.[storage_provider], f.[bucket_name], f.[object_key], f.[id];
            """;
        var result = new List<FileEvidence>();
        await using (var command = Command(connection, transaction, selectSql))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                var id = reader.GetGuid(0);
                var storageProvider = reader.GetString(1);
                var bucketName = reader.GetString(2);
                var objectKey = reader.GetString(3);
                var recoveryKey = BuildRecoveryKey(resetRunId, storageProvider, bucketName, objectKey);
                result.Add(new FileEvidence(
                    id,
                    storageProvider,
                    bucketName,
                    objectKey,
                    recoveryKey,
                    reader.GetInt64(4),
                    reader.IsDBNull(5) ? null : reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.IsDBNull(7) ? null : reader.GetGuid(7),
                    sharedIds.Contains(id) ? "unlink-only" : "delete-after-sql",
                    reader.GetBoolean(8)));
            }
        }

        return result;
    }

    internal static string BuildRecoveryKey(string resetRunId, string storageProvider, string bucketName, string objectKey)
    {
        if (string.IsNullOrWhiteSpace(objectKey) || objectKey.StartsWith("/", StringComparison.Ordinal) ||
            objectKey.Contains("\\", StringComparison.Ordinal) ||
            objectKey.Any(character => character <= '\u001f' || character == '\u007f') ||
            objectKey.StartsWith("quarantine/", StringComparison.OrdinalIgnoreCase) ||
            objectKey.Split('/').Any(segment => segment is "" or "." or ".."))
            throw new InvalidOperationException("An Event file has an unsafe storage object key.");
        if (Encoding.UTF8.GetByteCount(objectKey) > 1024)
            throw new InvalidOperationException("An Event file storage object key exceeds the protected Worker key limit.");
        var basename = objectKey.Split('/')[^1];
        var identityHash = Sha256(storageProvider + "\n" + bucketName + "\n" + objectKey);
        var recoveryKey = $"quarantine/event-reset/{resetRunId}/{identityHash}/{basename}";
        if (Encoding.UTF8.GetByteCount(recoveryKey) > 1024)
            throw new InvalidOperationException("An Event file recovery object key exceeds the protected Worker key limit.");
        if (Encoding.UTF8.GetByteCount(recoveryKey + ".metadata.json") > 1024)
            throw new InvalidOperationException("An Event file recovery metadata key exceeds the protected Worker key limit.");
        return recoveryKey;
    }

    private static async Task<TableEvidence> ReadTableEvidenceAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        TableInfo table,
        CancellationToken cancellationToken)
    {
        if (table.PrimaryKeyColumns.Count == 0)
            throw new InvalidOperationException($"Event table {table.QualifiedName} has no primary key.");
        var select = string.Join(", ", table.PrimaryKeyColumns.Select(Quote));
        var order = string.Join(", ", table.PrimaryKeyColumns.Select(Quote));
        var keys = new List<string>();
        await using (var command = Command(connection, transaction, $"SELECT {select} FROM {Qualified(table)} ORDER BY {order}"))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
                keys.Add(CanonicalRow(reader));
        }
        var (rowCount, rowHash) = await HashTableAsync(connection, transaction, table, null, cancellationToken);
        if (rowCount != keys.Count)
            throw new InvalidOperationException($"Event table {table.QualifiedName} changed while its reset evidence was being read.");
        return new TableEvidence(rowCount, keys, rowHash);
    }

    private static async Task<IReadOnlyList<string>> ReadSoftReferenceIdsAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        string tableName,
        string predicate,
        CancellationToken cancellationToken)
    {
        if (!metadata.TryGetTable(tableName, out var table))
            return Array.Empty<string>();
        var key = table.PrimaryKeyColumns.SingleOrDefault()
            ?? throw new InvalidOperationException($"{table.QualifiedName} does not have a single primary key.");
        var result = new List<string>();
        await using var command = Command(connection, transaction,
            $"SELECT {Quote(key)} FROM {Qualified(table)} WHERE {predicate} ORDER BY {Quote(key)}");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            result.Add(CanonicalValue(reader.GetValue(0)));
        return result;
    }

    private static Task<IReadOnlyList<string>> ReadDelegationIdsAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        CancellationToken cancellationToken) =>
        ReadSoftReferenceIdsAsync(connection, transaction, metadata, "event_package_approval_delegations", "[scope_type] IN (1, 2)", cancellationToken);

    private static async Task<IReadOnlyList<string>> ReadWholeTableIdsAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        string tableName,
        CancellationToken cancellationToken)
    {
        if (!metadata.TryGetTable(tableName, out var table))
            return Array.Empty<string>();
        return (await ReadTableEvidenceAsync(connection, transaction, table, cancellationToken)).PrimaryKeys;
    }

    private static async Task<(long Count, string Hash)> HashTableAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        TableInfo table,
        string? filter,
        CancellationToken cancellationToken)
    {
        if (table.PrimaryKeyColumns.Count == 0)
            throw new InvalidOperationException($"Preserved table {table.QualifiedName} has no primary key; a stable hash cannot be produced.");
        var columns = table.Columns.Values.OrderBy(column => column.Ordinal).ToArray();
        var sql = $"SELECT {string.Join(", ", columns.Select(column => Quote(column.Name)))} FROM {Qualified(table)}" +
                  (filter is null ? "" : " WHERE " + filter) +
                  " ORDER BY " + string.Join(", ", table.PrimaryKeyColumns.Select(Quote));
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        long count = 0;
        await using var command = Command(connection, transaction, sql);
        command.CommandTimeout = 0;
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SequentialAccess, cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            count++;
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var value = reader.IsDBNull(i) ? "<null>" : CanonicalValue(reader.GetValue(i));
                var bytes = Encoding.UTF8.GetBytes(value);
                hash.AppendData(BitConverter.GetBytes(bytes.Length));
                hash.AppendData(bytes);
            }
        }
        return (count, Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant());
    }

    private static async Task<IReadOnlyList<string>> ReadMigrationsAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        DatabaseMetadata metadata,
        CancellationToken cancellationToken)
    {
        if (!metadata.TryGetTable("__EFMigrationsHistory", out var history))
            throw new InvalidOperationException("The target does not contain __EFMigrationsHistory.");
        var migrationIdColumn = history.Columns.ContainsKey("migration_id")
            ? "migration_id"
            : history.Columns.ContainsKey("MigrationId")
                ? "MigrationId"
                : throw new InvalidOperationException("The migration history table does not contain a known migration id column.");
        var result = new List<string>();
        await using var command = Command(connection, transaction,
            $"SELECT {Quote(migrationIdColumn)} FROM [dbo].[__EFMigrationsHistory] ORDER BY {Quote(migrationIdColumn)}");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            result.Add(reader.GetString(0));
        return result;
    }

    private static async Task<long> ExecuteDeleteAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        DatabaseMetadata metadata,
        string tableName,
        string? predicate,
        CancellationToken cancellationToken)
    {
        if (!metadata.TryGetTable(tableName, out var table))
            return 0;
        return await ExecuteDeleteAsync(connection, transaction, table, predicate, cancellationToken);
    }

    private static async Task<long> ExecuteDeleteAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        TableInfo table,
        string? predicate,
        CancellationToken cancellationToken)
    {
        var sql = $"DELETE FROM {Qualified(table)}" + (predicate is null ? "" : " WHERE " + predicate) + "; SELECT CONVERT(bigint, @@ROWCOUNT);";
        return await ExecuteScalarInt64Async(connection, transaction, sql, cancellationToken);
    }

    private async Task ValidateFileReceiptAsync(
        string? path,
        Manifest manifest,
        string receiptKind,
        bool requiredWhenFilesExist,
        CancellationToken cancellationToken)
    {
        var exclusiveCount = manifest.Files.Count(file => file.Disposition == "delete-after-sql");
        if (exclusiveCount == 0)
            return;
        if (!requiredWhenFilesExist || string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            throw new InvalidOperationException($"A verified exact-key file {receiptKind} receipt is required.");
        var receipt = JsonSerializer.Deserialize<FileOperationReceipt>(await File.ReadAllTextAsync(path, cancellationToken), _json)
            ?? throw new InvalidOperationException($"The file {receiptKind} receipt is invalid.");
        if (!FixedTimeEquals(receipt.ManifestHash, manifest.FileManifestHash) ||
            !string.Equals(receipt.ResetRunId, manifest.ResetRunId, StringComparison.Ordinal) ||
            !string.Equals(receipt.Operation, receiptKind, StringComparison.OrdinalIgnoreCase) ||
            !FixedTimeEquals(receipt.ApprovedFingerprint, manifest.Fingerprint) ||
            !string.Equals(receipt.TargetResource, manifest.TargetResource, StringComparison.Ordinal) ||
            !string.Equals(receipt.ResetEpoch, manifest.FreezeEpoch, StringComparison.Ordinal) ||
            !string.Equals(receipt.SchemaEpoch, EventCompositionDefinitions.SchemaVersion, StringComparison.Ordinal) ||
            receipt.Failures.Count != 0 || !receipt.Verified)
            throw new InvalidOperationException($"The file {receiptKind} receipt does not verify the current exact-key manifest.");
        if (!string.Equals(receipt.BackupReference, _options.BackupReference, StringComparison.Ordinal))
            throw new InvalidOperationException($"The file {receiptKind} receipt does not match the approved recovery reference.");
    }

    private async Task<bool> ValidatePriorApplyReceiptIfPresentAsync(Manifest preview, CancellationToken cancellationToken)
    {
        var path = Path.Combine(_options.OutputDirectory, "apply.json");
        if (!File.Exists(path))
            return false;
        var receipt = JsonSerializer.Deserialize<ApplyReceipt>(await File.ReadAllTextAsync(path, cancellationToken), _json)
            ?? throw new InvalidOperationException("The prior apply receipt is invalid.");
        if (!string.Equals(receipt.ManifestVersion, ManifestVersion, StringComparison.Ordinal) ||
            !FixedTimeEquals(receipt.PreviewFingerprint, preview.Fingerprint) ||
            !FixedTimeEquals(receipt.FileManifestHash, preview.FileManifestHash) ||
            !string.Equals(receipt.CodeSha, _options.CodeSha, StringComparison.Ordinal) ||
            !FixedTimeEquals(receipt.ToolBuildHash, preview.ToolBuildHash) ||
            !string.Equals(receipt.FreezeEpoch, _options.FreezeEpoch, StringComparison.Ordinal) ||
            !string.Equals(receipt.ResetRunId, _options.ResetRunId, StringComparison.Ordinal) ||
            !string.Equals(receipt.TargetResource, _options.TargetResource, StringComparison.Ordinal) ||
            !string.Equals(receipt.BackupReference, _options.BackupReference, StringComparison.Ordinal) ||
            receipt.IrreversibleNoRecovery != _options.IrreversibleNoRecovery)
            throw new InvalidOperationException("The prior apply receipt does not match the approved reset context.");
        return true;
    }

    private async Task ValidateProductionBackupAsync(Manifest source, CancellationToken cancellationToken)
    {
        if (!_options.IsProduction || _options.IrreversibleNoRecovery)
            return;
        await using var connection = new SqlConnection(_options.VerifiedBackupConnectionString!);
        await connection.OpenAsync(cancellationToken);
        var identity = await ReadTargetAsync(connection, null, cancellationToken);
        var sourceResource = ParseAzureSqlResourceId(_options.TargetResource, "Events:TargetResource");
        var backupResource = ParseAzureSqlResourceId(_options.BackupReference, "Events:VerifiedBackupReference");
        if (string.Equals(sourceResource.Server, backupResource.Server, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(sourceResource.Database, backupResource.Database, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The named recovery database must be a distinct Azure SQL resource.");
        if (!AzureServerResourceEquals(identity.ConnectionEndpoint, backupResource.Server) ||
            !string.Equals(identity.Database, backupResource.Database, StringComparison.OrdinalIgnoreCase) ||
            identity.IsReadOnly)
            throw new InvalidOperationException("The verified recovery connection does not identify the named production database copy.");

        var backup = await BuildManifestAsync(connection, null, cancellationToken);
        var sourceProof = BackupComparisonProof(source);
        var backupProof = BackupComparisonProof(backup);
        if (!FixedTimeEquals(sourceProof, backupProof))
            throw new InvalidOperationException("The named production database copy does not match the reviewed source schema, rows, and stable hashes.");
    }

    private void ValidateApprovedManifestContext(Manifest preview)
    {
        if (!string.Equals(preview.ManifestVersion, ManifestVersion, StringComparison.Ordinal) ||
            !FixedTimeEquals(CalculateFingerprint(preview), preview.Fingerprint) ||
            !string.Equals(preview.CodeSha, _options.CodeSha, StringComparison.Ordinal) ||
            !FixedTimeEquals(preview.ToolBuildHash, CalculateToolBuildHash()) ||
            !string.Equals(preview.TargetResource, _options.TargetResource, StringComparison.Ordinal) ||
            !string.Equals(preview.FreezeEpoch, _options.FreezeEpoch, StringComparison.Ordinal) ||
            !string.Equals(preview.ResetRunId, _options.ResetRunId, StringComparison.Ordinal) ||
            !string.Equals(preview.BackupReference, _options.BackupReference, StringComparison.Ordinal) ||
            preview.IrreversibleNoRecovery != _options.IrreversibleNoRecovery ||
            !ServerEquals(preview.Target.ConnectionEndpoint, _options.ExpectedServer) ||
            !string.Equals(preview.Target.Database, _options.ExpectedDatabase, StringComparison.Ordinal))
            throw new InvalidOperationException("The approved preview evidence does not match this code, target, freeze epoch, run, or recovery mode.");
    }

    private static string BackupComparisonProof(Manifest manifest)
    {
        var proof = new
        {
            manifest.ToolBuildHash,
            manifest.SchemaHash,
            manifest.SchemaProfile,
            manifest.Migrations,
            manifest.EventIds,
            manifest.ProjectIds,
            manifest.Tables,
            manifest.AuditIds,
            manifest.NotificationIds,
            manifest.DelegationIds,
            manifest.IdempotencyIds,
            manifest.Files,
            manifest.FileManifestHash,
            manifest.DeleteCounts,
            manifest.PreservedTableCounts,
            manifest.PreservedTableHashes
        };
        return Sha256(JsonSerializer.Serialize(proof, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    private async Task WriteEvidenceAsync<T>(string fileName, T value, CancellationToken cancellationToken)
    {
        var path = Path.Combine(_options.OutputDirectory, fileName);
        var temporary = path + ".tmp";
        await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(value, _json), cancellationToken);
        File.Move(temporary, path, overwrite: true);
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }

    private static string CalculateFingerprint(Manifest manifest)
    {
        var input = new
        {
            manifest.ManifestVersion,
            manifest.Target,
            manifest.TargetResource,
            manifest.CodeSha,
            manifest.ToolBuildHash,
            manifest.FreezeEpoch,
            manifest.ResetRunId,
            manifest.BackupReference,
            manifest.IrreversibleNoRecovery,
            manifest.SchemaHash,
            manifest.SchemaProfile,
            manifest.Migrations,
            manifest.EventIds,
            manifest.ProjectIds,
            manifest.Tables,
            manifest.AuditIds,
            manifest.NotificationIds,
            manifest.DelegationIds,
            manifest.IdempotencyIds,
            manifest.Files,
            manifest.FileManifestHash,
            manifest.DeleteCounts,
            manifest.PreservedTableCounts,
            manifest.PreservedTableHashes
        };
        return Sha256(JsonSerializer.Serialize(input, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    private static string Sha256(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static string SensitiveEvidenceHash(IEnumerable<string> values) =>
        Sha256(string.Join("\n", values.OrderBy(value => value, StringComparer.Ordinal)));

    private static string CalculateToolBuildHash()
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var files = Directory.EnumerateFiles(AppContext.BaseDirectory, "Alife*.dll", SearchOption.TopDirectoryOnly)
            .OrderBy(Path.GetFileName, StringComparer.Ordinal);
        foreach (var file in files)
        {
            var nameBytes = Encoding.UTF8.GetBytes(Path.GetFileName(file));
            hash.AppendData(BitConverter.GetBytes(nameBytes.Length));
            hash.AppendData(nameBytes);
            using var stream = File.OpenRead(file);
            hash.AppendData(SHA256.HashData(stream));
        }
        return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
    }

    internal static string CalculateFileManifestHash(IEnumerable<FileEvidence> files)
    {
        var rows = files
            .Where(file => file.Disposition == "delete-after-sql")
            .OrderBy(file => file.StorageProvider, StringComparer.Ordinal)
            .ThenBy(file => file.BucketName, StringComparer.Ordinal)
            .ThenBy(file => file.ObjectKey, StringComparer.Ordinal)
            .Select(file => new object?[]
            {
                file.StorageProvider,
                file.BucketName,
                file.ObjectKey,
                file.RecoveryKey,
                file.SizeBytes,
                file.ETag
            })
            .ToArray();
        var canonical = JsonSerializer.Serialize(rows, new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        });
        return Sha256(canonical);
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left.Trim());
        var rightBytes = Encoding.UTF8.GetBytes(right.Trim());
        return leftBytes.Length == rightBytes.Length && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }

    private static bool DictionaryEqual<TKey, TValue>(
        IReadOnlyDictionary<TKey, TValue> left,
        IReadOnlyDictionary<TKey, TValue> right) where TKey : notnull =>
        left.Count == right.Count && left.All(pair => right.TryGetValue(pair.Key, out var value) && EqualityComparer<TValue>.Default.Equals(pair.Value, value));

    private static bool ServerEquals(string actual, string expected)
    {
        static string Normalize(string value) => value.Trim().Replace("tcp:", "", StringComparison.OrdinalIgnoreCase).ToLowerInvariant();
        return string.Equals(Normalize(actual), Normalize(expected), StringComparison.Ordinal);
    }

    private static bool IsWithin(string root, string candidate)
    {
        var relative = Path.GetRelativePath(root, candidate);
        return !Path.IsPathRooted(relative) &&
               !relative.Equals("..", StringComparison.Ordinal) &&
               !relative.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) &&
               !relative.StartsWith(".." + Path.AltDirectorySeparatorChar, StringComparison.Ordinal);
    }

    private static bool AzureServerResourceEquals(string endpoint, string resourceServer)
    {
        var normalized = endpoint.Trim().Replace("tcp:", "", StringComparison.OrdinalIgnoreCase);
        normalized = normalized.Split(',', 2)[0].Trim().TrimEnd('.');
        return string.Equals(normalized, resourceServer, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalized, resourceServer + ".database.windows.net", StringComparison.OrdinalIgnoreCase);
    }

    private static AzureSqlResource ParseAzureSqlResourceId(string value, string optionName)
    {
        var match = Regex.Match(value.Trim(),
            "^/subscriptions/(?<subscription>[^/]+)/resourceGroups/(?<resourceGroup>[^/]+)/providers/Microsoft\\.Sql/servers/(?<server>[^/]+)/databases/(?<database>[^/]+)$",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (!match.Success)
            throw new InvalidOperationException($"{optionName} must be a full Azure SQL database resource ID.");
        return new AzureSqlResource(
            match.Groups["subscription"].Value,
            match.Groups["resourceGroup"].Value,
            match.Groups["server"].Value,
            match.Groups["database"].Value);
    }

    private static string Require(IConfiguration configuration, string key) =>
        string.IsNullOrWhiteSpace(configuration[key])
            ? throw new InvalidOperationException($"{key} is required for Event instance purge.")
            : configuration[key]!.Trim();

    private static string ValidateResetRunId(string value)
    {
        if (!Regex.IsMatch(value, "^[A-Za-z0-9._-]{1,128}$", RegexOptions.CultureInvariant))
            throw new InvalidOperationException("Events:ResetRunId may contain only letters, numbers, dot, underscore, and hyphen.");
        return value;
    }

    private static void ValidateEvidenceDirectory(IConfiguration configuration, string outputDirectory, bool isProduction)
    {
        var output = Path.GetFullPath(outputDirectory).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (isProduction)
        {
            var protectedRootValue = Require(configuration, "Events:ProtectedEvidenceRoot");
            var protectedRoot = Path.GetFullPath(protectedRootValue).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!output.StartsWith(protectedRoot, StringComparison.Ordinal))
                throw new InvalidOperationException("Production evidence must remain inside Events:ProtectedEvidenceRoot.");
            return;
        }

        var localRoots = new[] { "C:/Data/Alife/Temp", "C:/Data/Alife/Backups" }
            .Select(path => Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar);
        if (!localRoots.Any(root => output.StartsWith(root, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Local Event reset evidence must remain under C:/Data/Alife/Temp or C:/Data/Alife/Backups.");
    }

    private static void ValidateLocalBackup(string backupReference, string receiptPath, string expectedDatabase)
    {
        var pathValue = backupReference.StartsWith("file:", StringComparison.OrdinalIgnoreCase)
            ? new Uri(backupReference).LocalPath
            : backupReference;
        if (!Path.IsPathFullyQualified(pathValue))
            throw new InvalidOperationException("Local Event purge requires an absolute verified backup path.");
        var path = Path.GetFullPath(pathValue);
        var root = Path.GetFullPath("C:/Data/Alife/Backups").TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(path) || new FileInfo(path).Length == 0)
            throw new InvalidOperationException("The verified local backup must be a non-empty file under C:/Data/Alife/Backups.");
        if (!Path.IsPathFullyQualified(receiptPath) || !File.Exists(receiptPath))
            throw new InvalidOperationException("Local Event purge requires a backup verification receipt.");
        var receipt = JsonSerializer.Deserialize<LocalBackupVerificationReceipt>(File.ReadAllText(receiptPath),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("The local backup verification receipt is invalid.");
        if (!receipt.RestoreVerifyOnly ||
            !string.Equals(Path.GetFullPath(receipt.BackupPath), path, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(receipt.DatabaseName, expectedDatabase, StringComparison.Ordinal) ||
            receipt.VerifiedUtc < DateTimeOffset.UtcNow.AddDays(-1))
            throw new InvalidOperationException("The local backup receipt does not prove a recent RESTORE VERIFYONLY for this database backup.");
        using var stream = File.OpenRead(path);
        var actualHash = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
        if (!FixedTimeEquals(actualHash, receipt.Sha256))
            throw new InvalidOperationException("The local backup file does not match its RESTORE VERIFYONLY receipt hash.");
    }

    private static SqlCommand Command(SqlConnection connection, SqlTransaction? transaction, string sql) =>
        new(sql, connection, transaction) { CommandTimeout = 0 };

    private static async Task ExecuteNonQueryAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = Command(connection, transaction, sql);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<long> ExecuteScalarInt64Async(
        SqlConnection connection,
        SqlTransaction? transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = Command(connection, transaction, sql);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt64(value, CultureInfo.InvariantCulture);
    }

    private static string Quote(string identifier) => "[" + identifier.Replace("]", "]]", StringComparison.Ordinal) + "]";
    private static string Qualified(TableInfo table) => Quote(table.Schema) + "." + Quote(table.Name);
    private static string CanonicalRow(SqlDataReader reader) =>
        string.Join("|", Enumerable.Range(0, reader.FieldCount).Select(index => CanonicalValue(reader.GetValue(index))));

    private static string CanonicalValue(object value) => value switch
    {
        DBNull => "<null>",
        byte[] bytes => Convert.ToBase64String(bytes),
        Guid guid => guid.ToString("D"),
        DateTime dateTime => dateTime.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
        DateTimeOffset dateTimeOffset => dateTimeOffset.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture) ?? "",
        _ => value.ToString() ?? ""
    };

    private const string AuditPredicate = """
        [event_id] IN (SELECT [id] FROM #purge_ids)
        OR [entity_id] IN (SELECT [id] FROM #purge_ids)
        OR [entity_id] IN (SELECT [id] FROM #event_file_ids)
        OR EXISTS (SELECT 1 FROM #purge_ids p WHERE
            CONVERT(nvarchar(max), [before_json]) LIKE N'%' + CONVERT(nvarchar(36), p.[id]) + N'%'
            OR CONVERT(nvarchar(max), [after_json]) LIKE N'%' + CONVERT(nvarchar(36), p.[id]) + N'%'
            OR CONVERT(nvarchar(max), [metadata_json]) LIKE N'%' + CONVERT(nvarchar(36), p.[id]) + N'%')
        OR EXISTS (SELECT 1 FROM #purge_activity_ids p WHERE
            (CHARINDEX(CONVERT(nvarchar(36), p.[event_id]), CONVERT(nvarchar(max), [before_json])) > 0
             AND CHARINDEX(p.[activity_id], CONVERT(nvarchar(max), [before_json])) > 0)
            OR (CHARINDEX(CONVERT(nvarchar(36), p.[event_id]), CONVERT(nvarchar(max), [after_json])) > 0
                AND CHARINDEX(p.[activity_id], CONVERT(nvarchar(max), [after_json])) > 0)
            OR (CHARINDEX(CONVERT(nvarchar(36), p.[event_id]), CONVERT(nvarchar(max), [metadata_json])) > 0
                AND CHARINDEX(p.[activity_id], CONVERT(nvarchar(max), [metadata_json])) > 0))
        OR EXISTS (SELECT 1 FROM #event_file_ids f WHERE
            CHARINDEX(CONVERT(nvarchar(36), f.[id]), CONVERT(nvarchar(max), [before_json])) > 0
            OR CHARINDEX(CONVERT(nvarchar(36), f.[id]), CONVERT(nvarchar(max), [after_json])) > 0
            OR CHARINDEX(CONVERT(nvarchar(36), f.[id]), CONVERT(nvarchar(max), [metadata_json])) > 0)
        """;

    private const string NotificationPredicate = """
        [event_id] IN (SELECT [id] FROM #purge_ids)
        OR EXISTS (SELECT 1 FROM #purge_ids p WHERE
            CONVERT(nvarchar(max), [action_data_json]) LIKE N'%' + CONVERT(nvarchar(36), p.[id]) + N'%'
            OR CONVERT(nvarchar(max), [response_data_json]) LIKE N'%' + CONVERT(nvarchar(36), p.[id]) + N'%')
        OR EXISTS (SELECT 1 FROM #purge_activity_ids p WHERE
            (CHARINDEX(CONVERT(nvarchar(36), p.[event_id]), CONVERT(nvarchar(max), [action_data_json])) > 0
             AND CHARINDEX(p.[activity_id], CONVERT(nvarchar(max), [action_data_json])) > 0)
            OR (CHARINDEX(CONVERT(nvarchar(36), p.[event_id]), CONVERT(nvarchar(max), [response_data_json])) > 0
                AND CHARINDEX(p.[activity_id], CONVERT(nvarchar(max), [response_data_json])) > 0))
        OR EXISTS (SELECT 1 FROM #event_file_ids f WHERE
            CHARINDEX(CONVERT(nvarchar(36), f.[id]), CONVERT(nvarchar(max), [action_data_json])) > 0
            OR CHARINDEX(CONVERT(nvarchar(36), f.[id]), CONVERT(nvarchar(max), [response_data_json])) > 0)
        """;

    internal enum PurgeMode { Preview, Apply, Verify }

    private sealed record Options(
        PurgeMode Mode,
        string OutputDirectory,
        string ExpectedServer,
        string ExpectedDatabase,
        string TargetResource,
        string CodeSha,
        string FreezeEpoch,
        string ResetRunId,
        string BackupReference,
        bool IrreversibleNoRecovery,
        bool IsProduction,
        bool WriteFreezeConfirmed,
        bool BackupVerified,
        string? VerifiedBackupConnectionString,
        string? ExpectedFingerprint,
        string? FileBackupReceiptPath,
        string? FileDeleteReceiptPath,
        bool IsIntegrationTest);

    internal sealed record Manifest(
        string ManifestVersion,
        DateTimeOffset GeneratedUtc,
        TargetIdentity Target,
        string TargetResource,
        string CodeSha,
        string ToolBuildHash,
        string FreezeEpoch,
        string ResetRunId,
        string BackupReference,
        bool IrreversibleNoRecovery,
        string SchemaHash,
        string SchemaProfile,
        IReadOnlyList<string> Migrations,
        IReadOnlyList<string> EventIds,
        IReadOnlyList<ProjectIdEvidence> ProjectIds,
        IReadOnlyDictionary<string, TableEvidence> Tables,
        IReadOnlyList<string> AuditIds,
        IReadOnlyList<string> NotificationIds,
        IReadOnlyList<string> DelegationIds,
        IReadOnlyList<string> IdempotencyIds,
        IReadOnlyList<FileEvidence> Files,
        string FileManifestHash,
        IReadOnlyDictionary<string, long> DeleteCounts,
        IReadOnlyDictionary<string, long> PreservedTableCounts,
        IReadOnlyDictionary<string, string> PreservedTableHashes,
        string Fingerprint);

    internal sealed record TargetIdentity(string ConnectionEndpoint, string ServerName, string Database, bool IsReadOnly, string ProductVersion, string EngineEdition);
    internal sealed record ProjectIdEvidence(Guid EventId, string ActivityId);
    internal sealed record TableEvidence(long Count, IReadOnlyList<string> PrimaryKeys, string RowHash);
    internal sealed record FileEvidence(Guid Id, string StorageProvider, string BucketName, string ObjectKey, string RecoveryKey, long SizeBytes, string? ETag, string? RelatedEntityType, Guid? RelatedEntityId, string Disposition, bool ClearRelatedEntity);
    internal sealed record FileManifest(string ResetRunId, string ManifestHash, IReadOnlyList<FileEvidence> Files);
    internal sealed record FileOperationReceipt(
        string Operation,
        string ResetRunId,
        string ManifestHash,
        string ApprovedFingerprint,
        string TargetResource,
        string ResetEpoch,
        string SchemaEpoch,
        bool Verified,
        string? BackupReference,
        IReadOnlyList<string> Failures);
    internal sealed record LocalBackupVerificationReceipt(string BackupPath, string DatabaseName, string Sha256, bool RestoreVerifyOnly, DateTimeOffset VerifiedUtc);
    internal sealed record ApplyReceipt(
        string ManifestVersion,
        string PreviewFingerprint,
        string FileManifestHash,
        string CodeSha,
        string ToolBuildHash,
        string FreezeEpoch,
        string ResetRunId,
        string TargetResource,
        string BackupReference,
        bool IrreversibleNoRecovery,
        DateTimeOffset AppliedUtc,
        IReadOnlyDictionary<string, long> DeletedRows,
        bool RecoveredAfterCommit);
    internal sealed record VerifyReceipt(string ManifestVersion, string PreviewFingerprint, string FileManifestHash, string CodeSha, string ToolBuildHash, DateTimeOffset VerifiedUtc, string SchemaHash, IReadOnlyDictionary<string, long> PreservedTableCounts, IReadOnlyDictionary<string, string> PreservedTableHashes);
    private sealed record AzureSqlResource(string Subscription, string ResourceGroup, string Server, string Database);

    private sealed record ColumnInfo(string Name, string TypeName, short MaxLength, byte Precision, byte Scale, bool IsNullable, int Ordinal, bool IsPrimaryKey, int PrimaryKeyOrdinal);
    private sealed record TableInfo(string Schema, string Name, IReadOnlyDictionary<string, ColumnInfo> Columns, IReadOnlyList<string> PrimaryKeyColumns)
    {
        public string QualifiedName => Schema + "." + Name;
    }
    private sealed record ForeignKeyInfo(
        string Name,
        string DependentTable,
        string PrincipalTable,
        IReadOnlyList<string> DependentColumns,
        IReadOnlyList<string> PrincipalColumns,
        bool IsDisabled,
        bool IsNotTrusted);
    private sealed record TraversalEdge(ForeignKeyInfo ForeignKey, bool CurrentIsDependent);
    private sealed record DatabaseMetadata(IReadOnlyDictionary<string, TableInfo> Tables, IReadOnlyList<ForeignKeyInfo> ForeignKeys)
    {
        public object SchemaFingerprintInput => new
        {
            Tables = Tables.Values.OrderBy(table => table.QualifiedName, StringComparer.Ordinal).Select(table => new
            {
                table.QualifiedName,
                Columns = table.Columns.Values.OrderBy(column => column.Ordinal),
                table.PrimaryKeyColumns
            }),
            ForeignKeys
        };

        public bool TryGetTable(string name, out TableInfo table) =>
            Tables.TryGetValue("dbo." + name, out table!);
    }
}
