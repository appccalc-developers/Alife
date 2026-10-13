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
    public void PendingMigration_RequiresOnlyTheExactCommandLineAuthorization()
    {
        Assert.Throws<InvalidOperationException>(() =>
            Event2DestructiveMigrationGate.RequireExplicitAuthorization(Pending,
                ["--Events:AllowEvent2DestructiveMigration=false"]));
        Assert.Throws<InvalidOperationException>(() =>
            Event2DestructiveMigrationGate.RequireExplicitAuthorization(Pending,
                [Event2DestructiveMigrationGate.AllowArgument, Event2DestructiveMigrationGate.AllowArgument]));
        Assert.Throws<InvalidOperationException>(() =>
            Event2DestructiveMigrationGate.RequireExplicitAuthorization(Pending,
                [Event2DestructiveMigrationGate.AllowArgument, "--Events:VerifiedResetRunId=obsolete"]));
    }

    [Fact]
    public void PendingMigration_AllowsTheExactAuthorizationSwitch()
    {
        Event2DestructiveMigrationGate.RequireExplicitAuthorization(Pending,
            [Event2DestructiveMigrationGate.AllowArgument]);
    }

    [Fact]
    public void NonemptyInstanceInspection_RejectsTheMigrationEvenWithAuthorization()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            Event2DestructiveMigrationGate.RequireEmptyInstanceInspection(false));

        Assert.Contains("EVENT2_DESTRUCTIVE_RESET_REQUIRED", error.Message, StringComparison.Ordinal);
        Event2DestructiveMigrationGate.RequireEmptyInstanceInspection(true);
    }

    [Fact]
    public void OtherMigrations_DoNotRequireEventResetAuthorization()
    {
        Event2DestructiveMigrationGate.RequireExplicitAuthorization(["20261013000000_Unrelated"], []);
    }
}
