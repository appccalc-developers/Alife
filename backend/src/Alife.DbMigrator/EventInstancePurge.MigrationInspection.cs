using Microsoft.Data.SqlClient;

namespace Alife.DbMigrator;

internal sealed partial class EventInstancePurge
{
    internal sealed record MigrationInstanceInspection(
        string SchemaProfile,
        IReadOnlyDictionary<string, long> RowCounts)
    {
        public bool InstanceDataEmpty => RowCounts.Values.All(count => count == 0);
    }

    // This is deliberately independent of the reset command. An ordinary migration must
    // inspect the live database before EF can apply even an earlier pending migration.
    internal static async Task<MigrationInstanceInspection> InspectForMigrationAsync(
        string connectionString,
        CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        var metadata = await ReadMetadataAsync(connection, null, cancellationToken);
        var schemaProfile = ValidateKnownSchema(metadata);
        var instanceTables = metadata.Tables.Values
            .Where(table => KnownInstanceTables.Contains(table.Name))
            .OrderBy(table => table.QualifiedName, StringComparer.Ordinal)
            .ToArray();

        ValidateSoftReferenceColumns(metadata, instanceTables);
        await ValidateInboundForeignKeysAsync(connection, null, metadata, instanceTables, cancellationToken);

        var counts = new SortedDictionary<string, long>(StringComparer.Ordinal);
        foreach (var table in instanceTables)
            counts[table.QualifiedName] = await CountAsync(connection, table, null, cancellationToken);

        if (metadata.TryGetTable("event_idempotency_records", out var idempotency))
            counts[idempotency.QualifiedName] = await CountAsync(connection, idempotency, null, cancellationToken);
        if (metadata.TryGetTable("event_package_approval_delegations", out var delegations))
            counts[delegations.QualifiedName + ":event-scopes"] = await CountAsync(
                connection, delegations, "[scope_type] IN (1, 2)", cancellationToken);

        // These are Event-owned soft references whose scope can be determined even after
        // their Event row is gone. Other audit and file records may belong to preserved
        // templates, policies, or unrelated modules, so they cannot be counted wholesale.
        if (metadata.TryGetTable("audit_logs", out var audits))
            counts[audits.QualifiedName + ":event-references"] = await CountAsync(
                connection, audits,
                "[event_id] IS NOT NULL OR LOWER([entity_type]) IN " +
                "(N'groupevent', N'group_event', N'eventoccurrence', N'eventpackage', " +
                "N'eventpackagecondition', N'eventrostergroup', N'event_activity_plan', N'eventramassessment')",
                cancellationToken);
        if (metadata.TryGetTable("notification_messages", out var notifications))
            counts[notifications.QualifiedName + ":event-references"] = await CountAsync(
                connection, notifications,
                "[event_id] IS NOT NULL OR LOWER([action_type]) LIKE N'event.%'",
                cancellationToken);
        if (metadata.TryGetTable("file_assets", out var files))
            counts[files.QualifiedName + ":event-references"] = await CountAsync(
                connection, files,
                "LOWER(ISNULL([related_entity_type], N'')) IN " +
                "(N'event', N'enrollment', N'eventregistrationparticipant')",
                cancellationToken);

        return new MigrationInstanceInspection(schemaProfile, counts);
    }

    private static Task<long> CountAsync(
        SqlConnection connection,
        TableInfo table,
        string? filter,
        CancellationToken cancellationToken) =>
        ExecuteScalarInt64Async(
            connection,
            null,
            $"SELECT COUNT_BIG(*) FROM {Qualified(table)}" +
            (filter is null ? "" : " WHERE " + filter),
            cancellationToken);
}
