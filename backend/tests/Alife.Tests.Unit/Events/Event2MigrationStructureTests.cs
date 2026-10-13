using Alife.Infrastructure.Persistence.Migrations;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace Alife.Tests.Unit.Events;

public sealed class Event2MigrationStructureTests
{
    [Fact]
    public void DestructiveMigration_GuardsBeforeDroppingLegacyStorage()
    {
        var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
        new TestableMigration().BuildUp(builder);

        var guard = Assert.IsType<SqlOperation>(builder.Operations[0]);
        Assert.Contains("EVENT2_DESTRUCTIVE_RESET_REQUIRED", guard.Sql, StringComparison.Ordinal);
        Assert.Contains("group_events", guard.Sql, StringComparison.Ordinal);
        Assert.Contains("event[_]%", guard.Sql, StringComparison.Ordinal);
        Assert.Contains("[scope_type] IN (1, 2)", guard.Sql, StringComparison.Ordinal);
        Assert.Contains("THROW 51020", guard.Sql, StringComparison.Ordinal);

        var droppedTables = builder.Operations.OfType<DropTableOperation>()
            .Select(operation => operation.Name)
            .ToHashSet(StringComparer.Ordinal);
        Assert.Subset(droppedTables, new HashSet<string>(StringComparer.Ordinal)
        {
            "event_enrollments",
            "event_enrollment_history",
            "event_artifacts",
            "event_workflow_runs",
            "event_workflow_steps"
        });

        var droppedColumns = builder.Operations.OfType<DropColumnOperation>()
            .Select(operation => (operation.Table, operation.Name))
            .ToHashSet();
        Assert.Contains(("group_events", "collaboration_version"), droppedColumns);
        Assert.Contains(("event_registration_applications", "legacy_enrollment_id"), droppedColumns);
        Assert.Contains(("event_registration_participants", "is_legacy"), droppedColumns);
        Assert.Contains(("event_safeguarding_child_registrations", "enrollment_id"), droppedColumns);
        Assert.Contains(("event_operations_tasks", "workflow_step_id"), droppedColumns);
    }

    private sealed class TestableMigration : Event2RemoveLegacyEventStorage
    {
        public void BuildUp(MigrationBuilder builder) => Up(builder);
    }
}
