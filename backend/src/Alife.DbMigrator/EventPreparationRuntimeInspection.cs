using System.Text.Json;
using Alife.Application.Events.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Alife.DbMigrator;

internal static class EventPreparationRuntimeInspection
{
    private const string InspectArgument = "--Events:PreparationRuntime=inspect";
    private const string DestructiveMigrationId = "20261012225333_Event2RemoveLegacyEventStorage";

    internal static async Task<bool> TryRunAsync(
        IConfiguration configuration,
        IReadOnlyCollection<string> arguments,
        string connectionString,
        AlifeDbContext db,
        CancellationToken cancellationToken = default)
    {
        var mode = configuration["Events:PreparationRuntime"];
        if (mode is null) return false;
        if (mode != "inspect" || arguments.Count(argument => argument == InspectArgument) != 1)
            throw new InvalidOperationException("Event preparation inspection requires the explicit inspect command.");

        var outputValue = configuration["Events:OutputDirectory"];
        if (string.IsNullOrWhiteSpace(outputValue) || !Path.IsPathFullyQualified(outputValue))
            throw new InvalidOperationException("Events:OutputDirectory must be an absolute path for Event preparation inspection.");
        var outputDirectory = Path.GetFullPath(outputValue);

        // A preparation artifact must keep the old business contract and must not contain
        // the forward-only post-reset migration. Check both its assembly and the live DB.
        var destructiveMigrationKnown = db.Database.GetMigrations()
            .Contains(DestructiveMigrationId, StringComparer.Ordinal);
        var legacyRuntimePreserved =
            EventCompositionDefinitions.SchemaVersion == "1.1.0" &&
            EventCompositionDefinitions.LegacySchemaVersion == "1.0.0";

        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NULL
               OR OBJECT_ID(N'[dbo].[group_events]', N'U') IS NULL
                THROW 51001, 'Event preparation requires the reviewed legacy database structure.', 1;
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM [dbo].[__EFMigrationsHistory]
                WHERE [migration_id] = N'20261012225333_Event2RemoveLegacyEventStorage'
            ) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END;
            SELECT COUNT_BIG(*) FROM [dbo].[group_events];
            """;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("Event preparation migration history probe returned no result.");
        var destructiveMigrationApplied = reader.GetBoolean(0);
        if (!await reader.NextResultAsync(cancellationToken) || !await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("Event preparation root inventory returned no result.");
        var eventRootCount = reader.GetInt64(0);

        if (!legacyRuntimePreserved || destructiveMigrationKnown || destructiveMigrationApplied)
            throw new InvalidOperationException("The Event preparation artifact or database is no longer legacy-preserving.");

        Directory.CreateDirectory(outputDirectory);
        var path = Path.Combine(outputDirectory, "event-preparation-runtime.json");
        var temporary = path + ".tmp";
        var result = new
        {
            compositionSchemaVersion = EventCompositionDefinitions.SchemaVersion,
            legacySchemaVersion = EventCompositionDefinitions.LegacySchemaVersion,
            legacyRuntimePreserved,
            destructiveMigrationKnown,
            destructiveMigrationApplied,
            eventRootCount
        };
        await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(result), cancellationToken);
        File.Move(temporary, path, overwrite: true);
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        Console.WriteLine("Event preparation runtime and live legacy schema verified without migration or seeding.");
        return true;
    }
}
