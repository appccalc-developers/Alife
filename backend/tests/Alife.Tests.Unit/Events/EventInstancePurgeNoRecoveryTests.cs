using Alife.DbMigrator;
using Microsoft.Extensions.Configuration;

namespace Alife.Tests.Unit.Events;

public sealed class EventInstancePurgeNoRecoveryTests
{
    private const string PurgeArgument = "--Events:PurgeInstances=preview";
    private const string NoRecoveryArgument = "--Events:NoRecovery=true";

    [Fact]
    public void Production_no_recovery_requires_its_exact_command_line_flag()
    {
        var configuration = Configuration();

        var error = Assert.Throws<InvalidOperationException>(() =>
            EventInstancePurge.TryCreate(configuration, [PurgeArgument], "unused", out _));

        Assert.Contains("--Events:NoRecovery=true", error.Message, StringComparison.Ordinal);
        Assert.True(EventInstancePurge.TryCreate(
            configuration, [PurgeArgument, NoRecoveryArgument], "unused", out var purge));
        Assert.NotNull(purge);

        Assert.Throws<InvalidOperationException>(() =>
            EventInstancePurge.TryCreate(configuration,
                [PurgeArgument, NoRecoveryArgument, NoRecoveryArgument], "unused", out _));
        Assert.Throws<InvalidOperationException>(() =>
            EventInstancePurge.TryCreate(
                Configuration(new Dictionary<string, string?> { ["Events:PurgeEnvironment"] = "Local" }),
                [PurgeArgument, NoRecoveryArgument], "unused", out _));
    }

    [Fact]
    public void No_recovery_rejects_any_claim_of_a_verified_backup()
    {
        foreach (var (setting, value) in new[]
        {
            ("Events:VerifiedBackupReference", "fake-copy"),
            ("Events:VerifiedBackupConnectionString", "fake-connection"),
            ("Events:BackupVerified", "true"),
            ("Events:FileBackupReceiptPath", "fake-receipt")
        })
        {
            var error = Assert.Throws<InvalidOperationException>(() =>
                EventInstancePurge.TryCreate(
                    Configuration(new Dictionary<string, string?> { [setting] = value }),
                    [PurgeArgument, NoRecoveryArgument], "unused", out _));

            Assert.Contains("must not claim a verified SQL or file backup", error.Message, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Irreversible_apply_still_requires_an_approved_fingerprint()
    {
        var configuration = Configuration(new Dictionary<string, string?>
        {
            ["Events:PurgeInstances"] = "apply"
        });

        var error = Assert.Throws<InvalidOperationException>(() =>
            EventInstancePurge.TryCreate(configuration,
                ["--Events:PurgeInstances=apply", NoRecoveryArgument], "unused", out _));

        Assert.Contains("ExpectedFingerprint", error.Message, StringComparison.Ordinal);
    }

    private static IConfiguration Configuration(IDictionary<string, string?>? overrides = null)
    {
        var values = new Dictionary<string, string?>
        {
            ["Events:PurgeInstances"] = "preview",
            ["Events:PurgeEnvironment"] = "Production",
            ["Events:ExpectedServer"] = "reviewed-server.database.windows.net",
            ["Events:ExpectedDatabase"] = "reviewed-db",
            ["Events:TargetResource"] = "/subscriptions/reviewed/resourceGroups/reviewed/providers/Microsoft.Sql/servers/reviewed-server/databases/reviewed-db",
            ["Events:CodeSha"] = new string('a', 40),
            ["Events:FreezeEpoch"] = "reviewed-epoch",
            ["Events:ResetRunId"] = "reviewed-run",
            ["Events:WriteFreezeConfirmed"] = "true",
            ["Events:NoRecovery"] = "true",
            ["Events:ProtectedEvidenceRoot"] = Path.GetFullPath("C:/Data/Alife/Temp/EventPurgeTests"),
            ["Events:OutputDirectory"] = Path.GetFullPath("C:/Data/Alife/Temp/EventPurgeTests/no-recovery")
        };
        if (overrides is not null)
            foreach (var (key, value) in overrides)
                values[key] = value;
        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }
}
