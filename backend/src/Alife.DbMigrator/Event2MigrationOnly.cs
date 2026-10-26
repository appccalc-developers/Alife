using Alife.Application.Events.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

namespace Alife.DbMigrator;

/// <summary>
/// One-time, Event-only production migration entry point. Ordinary DbMigrator execution
/// also performs unrelated seeding, sermon normalization and cache invalidation, so it
/// must not be used for the Event 2.0 cutover.
/// </summary>
internal sealed class Event2MigrationOnly
{
    internal const string PrerequisiteMigrationId = "20261011113522_AddEventProjectOperations";
    internal const string ApplyPrerequisiteArgument = "--Events:Event2MigrationOnly=apply-prerequisite";
    internal const string ApplyArgument = "--Events:Event2MigrationOnly=apply";
    internal const string VerifyArgument = "--Events:Event2MigrationOnly=verify";
    internal const string ProductionServer = "ccalc.database.windows.net";
    internal const string ProductionDatabase = "ccalc";
    internal const string ProductionResource =
        "/subscriptions/f909751a-dc61-4aa8-8a06-2e9e932fc02d/resourceGroups/ccalc/providers/Microsoft.Sql/servers/ccalc/databases/ccalc";

    private static readonly string[] RetiredTables =
    [
        "event_artifacts",
        "event_enrollment_history",
        "event_workflow_steps",
        "event_enrollments",
        "event_workflow_runs"
    ];

    private static readonly (string Table, string Column)[] RetiredColumns =
    [
        ("group_events", "collaboration_version"),
        ("event_safeguarding_child_registrations", "enrollment_id"),
        ("event_registration_participants", "is_legacy"),
        ("event_registration_applications", "legacy_enrollment_id"),
        ("event_plan_snapshots", "is_legacy_backfill"),
        ("event_operations_tasks", "workflow_step_id"),
        ("event_fact_sets", "is_legacy_backfill"),
        ("event_composition_occurrences", "is_legacy_backfill")
    ];

    private static readonly string[] PreservedTables =
    [
        "group_events",
        "event_activity_template_versions",
        "event_package_governance_policy_versions",
        "event_ram_policy_versions",
        "event_resource_venues",
        "event_safeguarding_policy_versions",
        "event_workflow_templates"
    ];

    private static readonly string[] ProjectOperationTables =
    [
        "event_activity_module_configurations",
        "event_activity_policy_versions",
        "event_participant_private_data",
        "event_activity_offers",
        "event_activity_participations",
        "event_activity_space_requests",
        "event_activity_consents",
        "event_activity_payments"
    ];

    private enum Mode { ApplyPrerequisite, Apply, Verify }

    private readonly string _connectionString;
    private readonly Mode _mode;

    private Event2MigrationOnly(string connectionString, Mode mode)
    {
        _connectionString = connectionString;
        _mode = mode;
    }

    internal static bool TryCreate(
        IConfiguration configuration,
        IReadOnlyCollection<string> arguments,
        string connectionString,
        out Event2MigrationOnly? command)
    {
        command = null;
        var mode = configuration["Events:Event2MigrationOnly"];
        if (mode is null && !arguments.Any(argument => argument.StartsWith("--Events:Event2MigrationOnly", StringComparison.Ordinal)))
            return false;

        var selectedMode = mode switch
        {
            "apply-prerequisite" => Mode.ApplyPrerequisite,
            "apply" => Mode.Apply,
            "verify" => Mode.Verify,
            _ => (Mode?)null
        };
        var requiredArgument = selectedMode switch
        {
            Mode.ApplyPrerequisite => ApplyPrerequisiteArgument,
            Mode.Apply => ApplyArgument,
            Mode.Verify => VerifyArgument,
            _ => null
        };
        if (requiredArgument is null || arguments.Count != 1 ||
            arguments.Count(argument => string.Equals(argument, requiredArgument, StringComparison.Ordinal)) != 1)
            throw new InvalidOperationException("Event 2.0 migration-only mode requires exactly one explicit apply-prerequisite, apply, or verify command-line argument.");

        if (!string.Equals(configuration["Events:PurgeEnvironment"], "Production", StringComparison.Ordinal) ||
            !string.Equals(configuration["Events:ExpectedServer"], ProductionServer, StringComparison.Ordinal) ||
            !string.Equals(configuration["Events:ExpectedDatabase"], ProductionDatabase, StringComparison.Ordinal) ||
            !string.Equals(configuration["Events:TargetResource"], ProductionResource, StringComparison.Ordinal) ||
            !string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Production", StringComparison.Ordinal))
            throw new InvalidOperationException("Event 2.0 migration-only mode requires the exact reviewed production target and environment.");

        var target = new SqlConnectionStringBuilder(connectionString);
        var endpoint = target.DataSource.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase)
            ? target.DataSource[4..]
            : target.DataSource;
        if (endpoint.EndsWith(",1433", StringComparison.Ordinal))
            endpoint = endpoint[..^5];
        if (!string.Equals(endpoint, ProductionServer, StringComparison.OrdinalIgnoreCase) ||
            !EventResetTargetIdentity.MatchesDatabase(target.InitialCatalog, ProductionDatabase))
        {
            throw new InvalidOperationException("The SQL connection is not the exact reviewed production database.");
        }

        if (selectedMode != Mode.Verify && !string.Equals(configuration["Events:WriteFreezeConfirmed"], "true", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Event 2.0 migration-only apply requires confirmed frozen Event writes.");

        command = new Event2MigrationOnly(connectionString, selectedMode!.Value);
        return true;
    }

    internal static void RequireExactPrerequisitePendingMigrations(IReadOnlyCollection<string> pending)
    {
        if (!pending.SequenceEqual([PrerequisiteMigrationId, Event2DestructiveMigrationGate.MigrationId], StringComparer.Ordinal))
            throw new InvalidOperationException("Event 2.0 prerequisite apply requires exactly the reviewed project-operations and Event 2.0 storage migrations pending in order.");
    }

    internal static void RequireSolePendingMigration(IReadOnlyCollection<string> pending)
    {
        if (pending.Count != 1 || !string.Equals(pending.Single(), Event2DestructiveMigrationGate.MigrationId, StringComparison.Ordinal))
            throw new InvalidOperationException("Event 2.0 migration-only apply requires the Event 2.0 storage migration as the sole pending migration.");
    }

    internal async Task RunAsync(AlifeDbContext db, CancellationToken cancellationToken = default)
    {
        var known = db.Database.GetMigrations().ToArray();
        if (!known.Contains(PrerequisiteMigrationId, StringComparer.Ordinal) ||
            !known.Contains(Event2DestructiveMigrationGate.MigrationId, StringComparer.Ordinal))
            throw new InvalidOperationException("The reviewed Event 2.0 migrations are missing from this DbMigrator build.");

        var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).ToArray();
        if (_mode == Mode.ApplyPrerequisite)
        {
            RequireExactPrerequisitePendingMigrations(pending);
            var inspection = await EventInstancePurge.InspectForMigrationAsync(_connectionString, cancellationToken);
            if (inspection.SchemaProfile != "legacy-67")
                throw new InvalidOperationException("Event 2.0 prerequisite apply requires the reviewed legacy-67 database schema.");
            Event2DestructiveMigrationGate.RequireEmptyInstanceInspection(inspection.InstanceDataEmpty);
            await db.GetService<IMigrator>().MigrateAsync(PrerequisiteMigrationId, cancellationToken);
            await VerifyPrerequisiteAsync(db, cancellationToken);
            Console.WriteLine("The Event project-operations prerequisite was applied and verified; only the Event 2.0 storage migration remains pending.");
            return;
        }

        if (_mode == Mode.Apply)
        {
            RequireSolePendingMigration(pending);
            var inspection = await EventInstancePurge.InspectForMigrationAsync(_connectionString, cancellationToken);
            if (inspection.SchemaProfile != "legacy-75")
                throw new InvalidOperationException("Event 2.0 storage apply requires the reviewed legacy-75 database schema.");
            Event2DestructiveMigrationGate.RequireEmptyInstanceInspection(inspection.InstanceDataEmpty);
            await db.GetService<IMigrator>().MigrateAsync(Event2DestructiveMigrationGate.MigrationId, cancellationToken);
        }
        else if (pending.Length != 0)
        {
            throw new InvalidOperationException("Event 2.0 migration-only verify found pending migrations.");
        }

        await VerifyAsync(db, cancellationToken);
        Console.WriteLine(_mode == Mode.Apply
            ? "The Event 2.0 storage migration was applied and verified on the reviewed production target."
            : "The Event 2.0 storage migration is applied and its retired storage is absent on the reviewed production target.");
    }

    private async Task VerifyPrerequisiteAsync(AlifeDbContext db, CancellationToken cancellationToken)
    {
        var applied = await db.Database.GetAppliedMigrationsAsync(cancellationToken);
        var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).ToArray();
        if (!applied.Contains(PrerequisiteMigrationId, StringComparer.Ordinal) ||
            applied.Contains(Event2DestructiveMigrationGate.MigrationId, StringComparer.Ordinal))
            throw new InvalidOperationException("Event 2.0 prerequisite verification failed: migration history is unexpected.");
        RequireSolePendingMigration(pending);

        var inspection = await EventInstancePurge.InspectForMigrationAsync(_connectionString, cancellationToken);
        if (inspection.SchemaProfile != "legacy-75")
            throw new InvalidOperationException("Event 2.0 prerequisite verification failed: schema is not the reviewed legacy-75 profile.");
        Event2DestructiveMigrationGate.RequireEmptyInstanceInspection(inspection.InstanceDataEmpty);

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        foreach (var table in ProjectOperationTables)
        {
            if (!await HasTableAsync(connection, table, cancellationToken))
                throw new InvalidOperationException($"Event 2.0 prerequisite verification failed: {table} is missing.");
        }
        if (!await HasColumnAsync(connection, "event_activity_template_versions", "preset_projects_json", cancellationToken))
            throw new InvalidOperationException("Event 2.0 prerequisite verification failed: the preset-project column is missing.");
    }

    private async Task VerifyAsync(AlifeDbContext db, CancellationToken cancellationToken)
    {
        var applied = await db.Database.GetAppliedMigrationsAsync(cancellationToken);
        var pending = await db.Database.GetPendingMigrationsAsync(cancellationToken);
        if (!applied.Contains(Event2DestructiveMigrationGate.MigrationId, StringComparer.Ordinal) || pending.Any())
            throw new InvalidOperationException("Event 2.0 migration verification failed: migration history is incomplete.");

        var inspection = await EventInstancePurge.InspectForMigrationAsync(_connectionString, cancellationToken);
        RequireFinalInstanceInspection(inspection);

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        foreach (var table in RetiredTables)
        {
            if (await HasTableAsync(connection, table, cancellationToken))
                throw new InvalidOperationException($"Event 2.0 migration verification failed: retired table {table} remains.");
        }
        foreach (var (table, column) in RetiredColumns)
        {
            if (await HasColumnAsync(connection, table, column, cancellationToken))
                throw new InvalidOperationException($"Event 2.0 migration verification failed: retired column {table}.{column} remains.");
        }
        foreach (var table in PreservedTables)
        {
            if (!await HasTableAsync(connection, table, cancellationToken))
                throw new InvalidOperationException($"Event 2.0 migration verification failed: preserved table {table} is missing.");
        }
    }

    internal static void RequireFinalInstanceInspection(EventInstancePurge.MigrationInstanceInspection inspection)
    {
        if (!string.Equals(inspection.SchemaProfile, "event-2.0", StringComparison.Ordinal))
            throw new InvalidOperationException("Event 2.0 migration verification failed: the database does not have the reviewed event-2.0 schema profile.");
        if (!inspection.InstanceDataEmpty)
            throw new InvalidOperationException("Event 2.0 migration verification failed: Event instance rows or references remain.");
    }

    private static async Task<bool> HasTableAsync(SqlConnection connection, string table, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand("SELECT COUNT_BIG(*) FROM sys.tables WHERE [schema_id] = SCHEMA_ID(N'dbo') AND [name] = @name", connection);
        command.Parameters.AddWithValue("@name", table);
        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken)) == 1;
    }

    private static async Task<bool> HasColumnAsync(SqlConnection connection, string table, string column, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(
            "SELECT COUNT_BIG(*) FROM sys.columns AS c JOIN sys.tables AS t ON t.[object_id] = c.[object_id] " +
            "WHERE t.[schema_id] = SCHEMA_ID(N'dbo') AND t.[name] = @table AND c.[name] = @column", connection);
        command.Parameters.AddWithValue("@table", table);
        command.Parameters.AddWithValue("@column", column);
        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken)) == 1;
    }
}
