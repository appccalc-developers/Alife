using Alife.DbMigrator;
using Microsoft.Extensions.Configuration;

namespace Alife.Tests.Unit.Events;

public sealed class Event2MigrationOnlyTests
{
    private const string Connection =
        "Server=tcp:ccalc.database.windows.net,1433;Database=ccalc;User ID=test;Password=test;Encrypt=True";

    [Fact]
    public void Apply_RequiresAnExactStandaloneCommandAndFrozenProductionTarget()
    {
        Assert.True(Event2MigrationOnly.TryCreate(
            Configuration("apply"), [Event2MigrationOnly.ApplyArgument], Connection, out var command));
        Assert.NotNull(command);

        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.TryCreate(
            Configuration("apply"), [], Connection, out _));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.TryCreate(
            Configuration("apply"), [Event2MigrationOnly.ApplyArgument, "--AdministratorActivation:Recover=true"], Connection, out _));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.TryCreate(
            Configuration("apply", new() { ["Events:WriteFreezeConfirmed"] = "false" }),
            [Event2MigrationOnly.ApplyArgument], Connection, out _));
    }

    [Fact]
    public void Apply_RejectsAnotherDatabaseOrResource()
    {
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.TryCreate(
            Configuration("apply"), [Event2MigrationOnly.ApplyArgument],
            Connection.Replace("Database=ccalc", "Database=other", StringComparison.Ordinal), out _));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.TryCreate(
            Configuration("apply", new() { ["Events:TargetResource"] = Event2MigrationOnly.ProductionResource + "-copy" }),
            [Event2MigrationOnly.ApplyArgument], Connection, out _));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.TryCreate(
            Configuration("apply", new() { ["ASPNETCORE_ENVIRONMENT"] = "Development" }),
            [Event2MigrationOnly.ApplyArgument], Connection, out _));
    }

    [Fact]
    public void Verify_IsReadOnlyModeAndDoesNotRequireAnApplyFreezeDeclaration()
    {
        Assert.True(Event2MigrationOnly.TryCreate(
            Configuration("verify", new() { ["Events:WriteFreezeConfirmed"] = "false" }),
            [Event2MigrationOnly.VerifyArgument], Connection, out var command));
        Assert.NotNull(command);
    }

    [Fact]
    public void Prerequisite_RequiresTheExactCommandAndFrozenProductionTarget()
    {
        Assert.True(Event2MigrationOnly.TryCreate(
            Configuration("apply-prerequisite"), [Event2MigrationOnly.ApplyPrerequisiteArgument], Connection, out var command));
        Assert.NotNull(command);
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.TryCreate(
            Configuration("apply-prerequisite"), [Event2MigrationOnly.ApplyArgument], Connection, out _));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.TryCreate(
            Configuration("apply-prerequisite", new() { ["Events:WriteFreezeConfirmed"] = "false" }),
            [Event2MigrationOnly.ApplyPrerequisiteArgument], Connection, out _));
    }

    [Fact]
    public void Prerequisite_RequiresExactlyTheTwoReviewedPendingMigrationsInOrder()
    {
        Event2MigrationOnly.RequireExactPrerequisitePendingMigrations(
            [Event2MigrationOnly.PrerequisiteMigrationId, Event2DestructiveMigrationGate.MigrationId]);
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.RequireExactPrerequisitePendingMigrations(
            [Event2DestructiveMigrationGate.MigrationId, Event2MigrationOnly.PrerequisiteMigrationId]));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.RequireExactPrerequisitePendingMigrations(
            [Event2MigrationOnly.PrerequisiteMigrationId]));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.RequireExactPrerequisitePendingMigrations(
            [Event2MigrationOnly.PrerequisiteMigrationId, Event2DestructiveMigrationGate.MigrationId, "unrelated"]));
    }

    [Fact]
    public void Apply_RequiresOnlyTheSingleExpectedPendingMigration()
    {
        Event2MigrationOnly.RequireSolePendingMigration([Event2DestructiveMigrationGate.MigrationId]);
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.RequireSolePendingMigration([]));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.RequireSolePendingMigration(
            [Event2DestructiveMigrationGate.MigrationId, "20261014000000_Unrelated"]));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.RequireSolePendingMigration(
            ["20261014000000_Unrelated"]));
    }

    [Fact]
    public void FinalVerify_RequiresTheReviewedEvent2SchemaAndNoInstanceReferences()
    {
        Event2MigrationOnly.RequireFinalInstanceInspection(new(
            "event-2.0", new Dictionary<string, long> { ["dbo.group_events"] = 0, ["dbo.audit_logs:event-references"] = 0 }));

        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.RequireFinalInstanceInspection(new(
            "legacy-75", new Dictionary<string, long> { ["dbo.group_events"] = 0 })));
        Assert.Throws<InvalidOperationException>(() => Event2MigrationOnly.RequireFinalInstanceInspection(new(
            "event-2.0", new Dictionary<string, long> { ["dbo.audit_logs:event-references"] = 1 })));
    }

    private static IConfiguration Configuration(string mode, Dictionary<string, string?>? overrides = null)
    {
        var values = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["Events:Event2MigrationOnly"] = mode,
            ["Events:PurgeEnvironment"] = "Production",
            ["Events:ExpectedServer"] = Event2MigrationOnly.ProductionServer,
            ["Events:ExpectedDatabase"] = Event2MigrationOnly.ProductionDatabase,
            ["Events:TargetResource"] = Event2MigrationOnly.ProductionResource,
            ["Events:WriteFreezeConfirmed"] = "true",
            ["ASPNETCORE_ENVIRONMENT"] = "Production"
        };
        if (overrides is not null)
        {
            foreach (var (key, value) in overrides)
                values[key] = value;
        }
        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }
}
