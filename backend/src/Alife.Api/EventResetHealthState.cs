using System.Data;
using System.Security.Cryptography;
using System.Text;
using Alife.Application.Events.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api;

public sealed record EventResetDataState(
    bool InventoryRecognized,
    bool DestructiveMigrationApplied,
    long EventRootCount,
    long EventInstanceRowCount);

public interface IEventResetDataProbe
{
    Task<EventResetDataState> ReadAsync(CancellationToken cancellationToken);
}

public interface IEventResetTargetIdentityProbe
{
    Task<string> ReadAsync(CancellationToken cancellationToken);
}

public sealed record EventResetHealthStatus(
    bool Healthy,
    string? SchemaEpoch,
    string? DataEpoch,
    string? ResetRunId,
    bool RollbackHold,
    bool FinalizationBlocksDeployment,
    bool FinalReleaseBlocksDeployment,
    bool VerifiedStateConfigured,
    bool InventoryRecognized,
    bool DestructiveMigrationApplied,
    long EventRootCount,
    long EventInstanceRowCount);

public sealed class EventResetHealthState(IConfiguration configuration, IEventResetDataProbe dataProbe)
{
    public bool IsHealthIdentity(string? authorization)
    {
        var expected = configuration["EVENT_RESET_FINALIZE_HEALTH_TOKEN"];
        var supplied = authorization?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
            ? authorization[7..].Trim()
            : string.Empty;
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(supplied)) return false;
        var left = SHA256.HashData(Encoding.UTF8.GetBytes(supplied));
        var right = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(left, right);
    }

    public async Task<EventResetHealthStatus> ReadAsync(CancellationToken cancellationToken)
    {
        var schemaEpoch = configuration["EVENT_SCHEMA_EPOCH"]?.Trim();
        var dataEpoch = configuration["EVENT_DATA_EPOCH"]?.Trim();
        var resetRunId = configuration["EVENT_RESET_LAST_VERIFIED_RUN_ID"]?.Trim();
        var verifiedState = configuration["EVENT_RESET_LAST_VERIFIED_STATE"]?.Trim();
        var verifiedSchemaEpoch = configuration["EVENT_RESET_LAST_VERIFIED_SCHEMA_EPOCH"]?.Trim();
        var verifiedEvidenceRunId = configuration["EVENT_RESET_LAST_VERIFIED_EVIDENCE_RUN_ID"]?.Trim();
        var verifiedCodeSha = configuration["EVENT_RESET_LAST_VERIFIED_CODE_SHA"]?.Trim();
        var verifiedFingerprint = configuration["EVENT_RESET_LAST_VERIFIED_FINGERPRINT"]?.Trim();
        var verifiedManifestHash = configuration["EVENT_RESET_LAST_VERIFIED_FILE_MANIFEST_HASH"]?.Trim();
        var verifiedBackupReference = configuration["EVENT_RESET_LAST_VERIFIED_BACKUP_REFERENCE"]?.Trim();
        var verifiedEpoch = configuration["EVENT_RESET_LAST_VERIFIED_EPOCH"]?.Trim();
        var finalizeState = configuration["EVENT_RESET_FINALIZE_STATE"]?.Trim();
        var rollbackState = configuration["EVENT_RESET_ROLLBACK_STATE"]?.Trim();
        var finalReleaseState = configuration["EVENT_RESET_FINAL_RELEASE_STATE"]?.Trim();
        var rollbackConfigured = bool.TryParse(configuration["EVENT_RESET_ROLLBACK_HOLD"], out var rollbackHold);
        var effectiveRollbackHold = !rollbackConfigured || rollbackHold || !string.IsNullOrEmpty(rollbackState);
        var finalizationBlocksDeployment = !string.IsNullOrEmpty(finalizeState) &&
            !string.Equals(finalizeState, "complete", StringComparison.Ordinal);
        var verifiedStateConfigured =
            string.Equals(verifiedState, "verified", StringComparison.Ordinal) &&
            string.Equals(verifiedSchemaEpoch, EventCompositionDefinitions.SchemaVersion, StringComparison.Ordinal) &&
            IsIdentifier(resetRunId) &&
            long.TryParse(verifiedEvidenceRunId, out var evidenceRunId) && evidenceRunId > 0 &&
            IsLowerHex(verifiedCodeSha, 40, 64) &&
            IsLowerHex(verifiedFingerprint, 64) &&
            IsLowerHex(verifiedManifestHash, 64) &&
            IsAzureSqlDatabaseResource(verifiedBackupReference) &&
            IsIdentifier(verifiedEpoch) &&
            string.Equals(dataEpoch, verifiedEpoch, StringComparison.Ordinal) &&
            rollbackConfigured;

        var data = await dataProbe.ReadAsync(cancellationToken);
        var finalReleaseBlocksDeployment =
            data.DestructiveMigrationApplied && verifiedStateConfigured &&
            !string.Equals(finalReleaseState, "complete", StringComparison.Ordinal);
        var healthy =
            string.Equals(schemaEpoch, EventCompositionDefinitions.SchemaVersion, StringComparison.Ordinal) &&
            IsIdentifier(dataEpoch) &&
            verifiedStateConfigured &&
            !effectiveRollbackHold &&
            !finalizationBlocksDeployment &&
            data.InventoryRecognized &&
            data.EventRootCount == 0 &&
            data.EventInstanceRowCount == 0;

        return new EventResetHealthStatus(
            healthy,
            schemaEpoch,
            dataEpoch,
            resetRunId,
            RollbackHold: effectiveRollbackHold,
            finalizationBlocksDeployment,
            finalReleaseBlocksDeployment,
            verifiedStateConfigured,
            data.InventoryRecognized,
            data.DestructiveMigrationApplied,
            data.EventRootCount,
            data.EventInstanceRowCount);
    }

    private static bool IsIdentifier(string? value) =>
        !string.IsNullOrEmpty(value) && value.Length <= 128 &&
        value.All(character => char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-');

    private static bool IsLowerHex(string? value, params int[] lengths) =>
        value is not null && lengths.Contains(value.Length) &&
        value.All(character => character is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static bool IsAzureSqlDatabaseResource(string? value) =>
        value is not null &&
        value.StartsWith("/subscriptions/", StringComparison.OrdinalIgnoreCase) &&
        value.Contains("/resourceGroups/", StringComparison.OrdinalIgnoreCase) &&
        value.Contains("/providers/Microsoft.Sql/servers/", StringComparison.OrdinalIgnoreCase) &&
        value.Contains("/databases/", StringComparison.OrdinalIgnoreCase);
}

public sealed class SqlEventResetDataProbe(AlifeDbContext db) : IEventResetDataProbe
{
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

    private static readonly HashSet<string> InstanceTables = new(StringComparer.OrdinalIgnoreCase)
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

    public async Task<EventResetDataState> ReadAsync(CancellationToken cancellationToken)
    {
        if (!db.Database.IsRelational())
            throw new InvalidOperationException("Event reset health requires a relational database.");

        var connection = db.Database.GetDbConnection();
        var closeAfter = connection.State != ConnectionState.Open;
        if (closeAfter) await connection.OpenAsync(cancellationToken);

        try
        {
            var tables = new List<(string Schema, string Name)>();
            await using (var inventory = connection.CreateCommand())
            {
                inventory.CommandText = "SELECT s.[name], t.[name] FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id;";
                await using var reader = await inventory.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                    tables.Add((reader.GetString(0), reader.GetString(1)));
            }

            var eventTables = tables
                .Where(table => table.Name.Equals("group_events", StringComparison.OrdinalIgnoreCase) ||
                                table.Name.StartsWith("event_", StringComparison.OrdinalIgnoreCase))
                .ToArray();

            var destructiveMigrationApplied = false;
            await using (var migration = connection.CreateCommand())
            {
                migration.CommandText = """
                    SELECT CASE
                        WHEN OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NOT NULL
                         AND EXISTS (
                             SELECT 1 FROM [dbo].[__EFMigrationsHistory]
                             WHERE [migration_id] = N'20261012225333_Event2RemoveLegacyEventStorage')
                        THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END;
                    """;
                destructiveMigrationApplied = Convert.ToBoolean(await migration.ExecuteScalarAsync(cancellationToken));
            }
            var hasEventRoot = eventTables.Any(table =>
                table.Schema.Equals("dbo", StringComparison.OrdinalIgnoreCase) &&
                table.Name.Equals("group_events", StringComparison.OrdinalIgnoreCase));
            var inventoryRecognized = hasEventRoot && eventTables.All(table =>
                table.Schema.Equals("dbo", StringComparison.OrdinalIgnoreCase) &&
                (InstanceTables.Contains(table.Name) || PreservedEventTables.Contains(table.Name) || SpecialEventTables.Contains(table.Name)));

            var presentInstances = eventTables
                .Where(table => table.Schema.Equals("dbo", StringComparison.OrdinalIgnoreCase) && InstanceTables.Contains(table.Name))
                .Select(table => table.Name)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToArray();

            long roots = 0;
            long instances = 0;
            foreach (var table in presentInstances)
            {
                await using var count = connection.CreateCommand();
                count.CommandText = $"SELECT COUNT_BIG(*) FROM [dbo].[{table.Replace("]", "]]", StringComparison.Ordinal)}];";
                var value = Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
                instances += value;
                if (table.Equals("group_events", StringComparison.OrdinalIgnoreCase)) roots = value;
            }

            if (eventTables.Any(table => table.Schema.Equals("dbo", StringComparison.OrdinalIgnoreCase) &&
                                         table.Name.Equals("event_idempotency_records", StringComparison.OrdinalIgnoreCase)))
            {
                await using var count = connection.CreateCommand();
                count.CommandText = "SELECT COUNT_BIG(*) FROM [dbo].[event_idempotency_records];";
                instances += Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
            }

            if (eventTables.Any(table => table.Schema.Equals("dbo", StringComparison.OrdinalIgnoreCase) &&
                                         table.Name.Equals("event_package_approval_delegations", StringComparison.OrdinalIgnoreCase)))
            {
                await using var count = connection.CreateCommand();
                count.CommandText = "SELECT COUNT_BIG(*) FROM [dbo].[event_package_approval_delegations] WHERE [scope_type] IN (1, 2);";
                instances += Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
            }

            return new EventResetDataState(inventoryRecognized, destructiveMigrationApplied, roots, instances);
        }
        finally
        {
            if (closeAfter) await connection.CloseAsync();
        }
    }
}

public sealed class SqlEventResetTargetIdentityProbe(AlifeDbContext db) : IEventResetTargetIdentityProbe
{
    public async Task<string> ReadAsync(CancellationToken cancellationToken)
    {
        if (!db.Database.IsRelational())
            throw new InvalidOperationException("Event reset target identity requires a relational database.");

        var connection = db.Database.GetDbConnection();
        var closeAfter = connection.State != ConnectionState.Open;
        if (closeAfter) await connection.OpenAsync(cancellationToken);
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT CONVERT(nvarchar(256), SERVERPROPERTY('ServerName')), DB_NAME();";
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken) || reader.IsDBNull(0) || reader.IsDBNull(1))
                throw new InvalidOperationException("The Event reset database target identity probe returned no identity.");
            return EventResetTargetIdentity.CalculateHash(reader.GetString(0), reader.GetString(1));
        }
        finally
        {
            if (closeAfter) await connection.CloseAsync();
        }
    }
}
