using Alife.DbMigrator;

namespace Alife.Tests.Unit.Events;

public sealed class Event2DestructiveMigrationGateTests
{
    private static readonly string[] Pending = [Event2DestructiveMigrationGate.MigrationId];

    [Fact]
    public void PendingMigration_RejectsAnOrdinaryMigratorRun()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            Event2DestructiveMigrationGate.RequireExplicitAuthorization(Pending, []));

        Assert.Contains("EVENT2_DESTRUCTIVE_RESET_REQUIRED", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void PendingMigration_RequiresBothExactCommandLineArguments()
    {
        Assert.Throws<InvalidOperationException>(() =>
            Event2DestructiveMigrationGate.RequireExplicitAuthorization(Pending,
                [Event2DestructiveMigrationGate.AllowArgument]));
        Assert.Throws<InvalidOperationException>(() =>
            Event2DestructiveMigrationGate.RequireExplicitAuthorization(Pending,
                [Event2DestructiveMigrationGate.AllowArgument, "--Events:VerifiedResetRunId=bad/value"]));
    }

    [Fact]
    public void PendingMigration_AllowsTheProtectedFinalReleaseArguments()
    {
        Event2DestructiveMigrationGate.RequireExplicitAuthorization(Pending,
        [
            Event2DestructiveMigrationGate.AllowArgument,
            "--Events:VerifiedResetRunId=event2-reset_2026.10.13"
        ]);
    }

    [Fact]
    public void OtherMigrations_DoNotRequireEventResetAuthorization()
    {
        Event2DestructiveMigrationGate.RequireExplicitAuthorization(["20261013000000_Unrelated"], []);
    }
}
