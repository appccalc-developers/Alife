using System.Text.Json;
using System.Text.RegularExpressions;
using Alife.Application.Events.Services;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Alife.DbMigrator;

internal static partial class EventResetTargetIdentityInspection
{
    private const string InspectArgument = "--Events:TargetIdentity=inspect";

    internal static async Task<bool> TryRunAsync(
        IConfiguration configuration,
        IReadOnlyCollection<string> arguments,
        string connectionString,
        CancellationToken cancellationToken = default)
    {
        var mode = configuration["Events:TargetIdentity"];
        if (mode is null) return false;
        if (!string.Equals(mode, "inspect", StringComparison.Ordinal) ||
            arguments.Count(argument => string.Equals(argument, InspectArgument, StringComparison.Ordinal)) != 1)
            throw new InvalidOperationException("Event reset target identity inspection requires the explicit inspect command.");

        var outputValue = Require(configuration, "Events:OutputDirectory");
        if (!Path.IsPathFullyQualified(outputValue))
            throw new InvalidOperationException("Events:OutputDirectory must be absolute for target identity inspection.");

        var expectedServer = Require(configuration, "Events:ExpectedServer");
        var expectedDatabase = Require(configuration, "Events:ExpectedDatabase");
        var targetResource = ParseAzureSqlResourceId(Require(configuration, "Events:TargetResource"));
        var connection = new SqlConnectionStringBuilder(connectionString);

        if (!EventResetTargetIdentity.MatchesServer(connection.DataSource, expectedServer) ||
            !EventResetTargetIdentity.MatchesDatabase(connection.InitialCatalog, expectedDatabase) ||
            !EventResetTargetIdentity.MatchesAzureResourceServer(connection.DataSource, targetResource.Server) ||
            !EventResetTargetIdentity.MatchesDatabase(connection.InitialCatalog, targetResource.Database))
            throw new InvalidOperationException("The configured Function App database identity does not match the protected Event reset target.");

        var outputDirectory = Path.GetFullPath(outputValue);
        Directory.CreateDirectory(outputDirectory);
        var path = Path.Combine(outputDirectory, "event-reset-target-identity.json");
        var temporary = path + ".tmp";
        var result = new
        {
            version = "event-reset-target/v1",
            targetIdentityHash = EventResetTargetIdentity.CalculateHash(connection.DataSource, connection.InitialCatalog)
        };
        await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(result), cancellationToken);
        File.Move(temporary, path, overwrite: true);
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        Console.WriteLine("Event reset target identity inspected and matched the protected resource.");
        return true;
    }

    private static string Require(IConfiguration configuration, string key) =>
        string.IsNullOrWhiteSpace(configuration[key])
            ? throw new InvalidOperationException($"{key} is required for Event reset target identity inspection.")
            : configuration[key]!.Trim();

    private static AzureSqlResource ParseAzureSqlResourceId(string value)
    {
        var match = AzureSqlResourcePattern().Match(value);
        if (!match.Success)
            throw new InvalidOperationException("Events:TargetResource must be a full Azure SQL database resource ID.");
        return new(match.Groups["server"].Value, match.Groups["database"].Value);
    }

    [GeneratedRegex("^/subscriptions/[^/\\s]+/resourceGroups/[^/\\s]+/providers/Microsoft\\.Sql/servers/(?<server>[^/\\s]+)/databases/(?<database>[^/\\s]+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AzureSqlResourcePattern();

    private sealed record AzureSqlResource(string Server, string Database);
}
