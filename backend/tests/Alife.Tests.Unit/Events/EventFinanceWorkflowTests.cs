using Alife.Application.Events.Commands.ReconcileEventFinance;
using Alife.Application.Events.Commands.SaveEventFinanceEntry;
using Alife.Application.Events.Queries.GetEventFinanceWorkspace;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventFinanceWorkflowTests
{
    [Fact]
    public void Finance_without_participant_charges_can_be_confirmed_for_budget_and_actuals()
    {
        var unconfirmed = Event("""{"enabledModules":["finance"],"currency":"NZD","optionalActivities":[],"financeLeaderConfirmed":false}""");
        var confirmed = Event("""{"enabledModules":["finance"],"currency":"NZD","optionalActivities":[],"financeLeaderConfirmed":true}""");

        Assert.Equal(EventModuleStatus.Configuring, EventFinancePolicy.ModuleStatus(unconfirmed));
        Assert.Equal(EventModuleStatus.Ready, EventFinancePolicy.ModuleStatus(confirmed));
    }

    [Fact]
    public void Finance_module_requires_complete_bilingual_rules_and_human_confirmation()
    {
        var groupEvent = Event("""{"currency":"NZD","baseFeePerAdult":20,"optionalActivities":[],"financeLeaderConfirmed":false}""");
        Assert.Equal(EventModuleStatus.Configuring, EventFinancePolicy.ModuleStatus(groupEvent));
        groupEvent.EventDataJson = """{"currency":"NZD","baseFeePerAdult":20,"optionalActivities":[],"paymentInstructions":{"en":"Pay online","zh":"网上付款"},"refundPolicy":{"en":"Refund before closing","zh":"截止前退款"},"financeLeaderConfirmed":true}""";
        Assert.Equal(EventModuleStatus.Ready, EventFinancePolicy.ModuleStatus(groupEvent));
        groupEvent.EventDataJson = """{"currency":"NZD","baseFeePerAdult":-1,"optionalActivities":[]}""";
        Assert.Equal(EventModuleStatus.Blocked, EventFinancePolicy.ModuleStatus(groupEvent));
    }

    [Fact]
    public void General_event_updates_cannot_reuse_confirmation_after_fee_change()
    {
        const string current = """{"baseFeePerAdult":20,"currency":"NZD","optionalActivities":[],"paymentInstructions":{"en":"Pay","zh":"付款"},"refundPolicy":{"en":"Refund","zh":"退款"},"financeLeaderConfirmed":true}""";
        const string changed = """{"baseFeePerAdult":25,"currency":"NZD","optionalActivities":[],"paymentInstructions":{"en":"Pay","zh":"付款"},"refundPolicy":{"en":"Refund","zh":"退款"},"financeLeaderConfirmed":true}""";
        var protectedJson = EventFinancePolicy.ProtectConfirmation(current, changed);
        Assert.Contains("\"financeLeaderConfirmed\":false", protectedJson);
        Assert.Contains("\"baseFeePerAdult\":25", protectedJson);
    }

    [Fact]
    public void Required_payment_evidence_is_enforced_by_the_server()
    {
        var groupEvent = Event("""{"paymentEvidenceRequired":true}""");

        Assert.False(EventRegistrationPolicy.ValidateEnrollmentRequirements(
            groupEvent, "{\"applicantName\":\"Alice\"}", out var missingError));
        Assert.Contains("required", missingError);
        Assert.True(EventRegistrationPolicy.ValidateEnrollmentRequirements(
            groupEvent, "{\"applicantName\":\"Alice\",\"paymentFiles\":[{\"url\":\"proof\"}]}", out _));
    }

    [Fact]
    public async Task Finance_workspace_summarizes_evidence_without_returning_file_urls()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var groupEvent = Event("""{"currency":"NZD","baseFeePerAdult":20,"optionalActivities":[],"paymentInstructions":{"en":"Pay","zh":"付款"},"refundPolicy":{"en":"Refund","zh":"退款"},"financeLeaderConfirmed":true}""");
        groupEvent.CreatedByMemberId = leaderId;
        db.GroupEvents.Add(groupEvent);
        db.EventEnrollments.Add(new EventEnrollment
        {
            Id = Guid.NewGuid(), GroupId = groupEvent.GroupId, EventId = groupEvent.Id, MemberId = Guid.NewGuid(),
            EnrollmentJson = """{"applicantName":"Alice","paymentFiles":[{"url":"https://private.example/proof.jpg"}]}""",
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var result = await new GetEventFinanceWorkspaceQueryHandler(db, authorization).Handle(
            new GetEventFinanceWorkspaceQuery(groupEvent.Id, leaderId), CancellationToken.None);
        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value!.EvidenceSubmissionCount);
        Assert.Equal(1, result.Value.EvidenceFileCount);
        Assert.Equal("Alice", result.Value.EvidenceSummaries.Single().ApplicantName);
        Assert.DoesNotContain("private.example", System.Text.Json.JsonSerializer.Serialize(result.Value));
    }

    [Fact]
    public async Task Finance_workspace_rejects_non_leaders()
    {
        await using var db = CreateDbContext();
        var groupEvent = Event("{}");
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var result = await new GetEventFinanceWorkspaceQueryHandler(db, authorization).Handle(
            new GetEventFinanceWorkspaceQuery(groupEvent.Id, Guid.NewGuid()), CancellationToken.None);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task Finance_workspace_is_unavailable_when_finance_is_not_in_the_event_plan()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var groupEvent = Event("{}");
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventFinanceWorkspaceQueryHandler(db, authorization).Handle(
            new GetEventFinanceWorkspaceQuery(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, result.Status);
    }

    [Fact]
    public async Task Saving_an_actual_entry_invalidates_reconciliation_and_closure_confirmation()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var groupEvent = Event("""{"enabledModules":["finance"],"currency":"NZD"}""");
        groupEvent.CreatedByMemberId = leaderId;
        groupEvent.FinanceReconciliation = new EventFinanceReconciliation
        {
            EventId = groupEvent.Id, NotesEn = "Checked", NotesZh = "已核对", LeaderConfirmed = true,
            ConfirmedByMemberId = leaderId, ConfirmedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        groupEvent.ClosureReport = new EventClosureReport
        {
            EventId = groupEvent.Id, SummaryEn = "Summary", SummaryZh = "总结", AttendanceNotes = "None",
            FinanceNotes = "Checked", IncidentNotes = "None", FollowUpNotes = "None", LeaderConfirmed = true,
            ConfirmedByMemberId = leaderId, ConfirmedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new SaveEventFinanceEntryCommandHandler(db, authorization).Handle(
            new SaveEventFinanceEntryCommand(groupEvent.Id, null, leaderId, EventFinanceEntryType.Expense,
                "Venue", "Venue hire", "场地租用", 125.567m, DateTime.UtcNow), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(125.57m, result.Value!.Amount);
        Assert.False(groupEvent.FinanceReconciliation.LeaderConfirmed);
        Assert.False(groupEvent.ClosureReport.LeaderConfirmed);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "event.finance.actual.saved");
    }

    [Fact]
    public async Task Zero_transaction_reconciliation_can_be_explicitly_confirmed_after_event_ends()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var groupEvent = Event("""{"enabledModules":["finance"],"currency":"NZD"}""");
        groupEvent.CreatedByMemberId = leaderId;
        groupEvent.StartDate = DateTime.UtcNow.AddHours(-3);
        groupEvent.EndDate = DateTime.UtcNow.AddHours(-1);
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new ReconcileEventFinanceCommandHandler(db, authorization).Handle(
            new ReconcileEventFinanceCommand(groupEvent.Id, leaderId, "No actual transactions.", "没有实际收支。", true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value!.LeaderConfirmed);
        Assert.Empty(await db.EventFinanceEntries.ToListAsync());
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "event.finance.reconciled");
    }

    private static GroupEvent Event(string dataJson) => new()
    {
        Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = Guid.NewGuid(),
        TitleEn = "Event", TitleZh = "活动", StartDate = DateTime.UtcNow.AddDays(1), EndDate = DateTime.UtcNow.AddDays(1).AddHours(2),
        EventDataJson = dataJson, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new AlifeDbContext(options);
    }
}
