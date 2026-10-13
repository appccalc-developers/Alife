using System.Text.Json;
using Alife.Application.Events.Services;
using Alife.DbMigrator;
using Microsoft.Extensions.Configuration;

namespace Alife.Tests.Unit.Events;

public sealed class EventResetTargetIdentityTests
{
    private const string ExpectedHash = "72012d925dc4a45f0913169aed80a12cd622cb7111ad42eab2559948e3230bf1";

    [Fact]
    public void Hash_NormalizesAzureEndpointPortCaseAndDatabaseCase()
    {
        var fromConnection = EventResetTargetIdentity.CalculateHash(
            "tcp:ALIFE-PROD.database.windows.net,1433",
            " ALIFE_DB ");
        var fromResource = EventResetTargetIdentity.CalculateHash("alife-prod", "alife_db");

        Assert.Equal(ExpectedHash, fromConnection);
        Assert.Equal(fromConnection, fromResource);
        Assert.True(EventResetTargetIdentity.MatchesServer(
            "tcp:alife-prod.database.windows.net,1433",
            "ALIFE-PROD"));
        Assert.True(EventResetTargetIdentity.MatchesAzureResourceServer(
            "alife-prod.database.windows.net",
            "alife-prod"));
        Assert.False(EventResetTargetIdentity.MatchesAzureResourceServer(
            "alife-prod.attacker.database.windows.net",
            "alife-prod"));
    }

    [Fact]
    public async Task Inspection_BindsConnectionToProtectedResourceWithoutWritingCredentials()
    {
        var outputDirectory = TemporaryDirectory();
        try
        {
            var configuration = Configuration(outputDirectory);
            const string connectionString =
                "Server=tcp:alife-prod.database.windows.net,1433;Initial Catalog=alife_db;" +
                "User ID=reset-user;Password=do-not-write-this;Encrypt=True;";

            var handled = await EventResetTargetIdentityInspection.TryRunAsync(
                configuration,
                ["--Events:TargetIdentity=inspect"],
                connectionString);

            Assert.True(handled);
            var report = await File.ReadAllTextAsync(
                Path.Combine(outputDirectory, "event-reset-target-identity.json"));
            using var document = JsonDocument.Parse(report);
            Assert.Equal(ExpectedHash, document.RootElement.GetProperty("targetIdentityHash").GetString());
            Assert.DoesNotContain("reset-user", report, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("do-not-write-this", report, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("database.windows.net", report, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task Inspection_TargetMismatchFailsClosedWithoutAnIdentityReport()
    {
        var outputDirectory = TemporaryDirectory();
        try
        {
            var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                EventResetTargetIdentityInspection.TryRunAsync(
                    Configuration(outputDirectory),
                    ["--Events:TargetIdentity=inspect"],
                    "Server=tcp:other.database.windows.net,1433;Initial Catalog=alife_db;Password=secret;"));

            Assert.Equal(
                "The configured Function App database identity does not match the protected Event reset target.",
                error.Message);
            Assert.False(File.Exists(Path.Combine(outputDirectory, "event-reset-target-identity.json")));
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    private static IConfiguration Configuration(string outputDirectory) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Events:TargetIdentity"] = "inspect",
            ["Events:OutputDirectory"] = outputDirectory,
            ["Events:ExpectedServer"] = "alife-prod",
            ["Events:ExpectedDatabase"] = "alife_db",
            ["Events:TargetResource"] =
                "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Sql/servers/alife-prod/databases/alife_db"
        }).Build();

    private static string TemporaryDirectory()
    {
        var path = Path.Combine(Path.GetTempPath(), "alife-event-reset-target-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }
}
