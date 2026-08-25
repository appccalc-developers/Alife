using Alife.Application.Groups.Services;
using System.Text.Json;
using Alife.Application.Rosters;
using Alife.Application.Rosters.Commands;
using Alife.Application.Rosters.Capabilities;
using Alife.Application.Rosters.Profiles;
using Alife.Application.Rosters.Queries;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Rosters;

public sealed class RosterWorkflowTests
{
    [Fact]
    public async Task Member_owns_availability_while_manager_labels_require_leader_and_are_audited()
    {
        await using var db = CreateDbContext();
        var setup = Seed(db);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsApprovedMemberAsync(setup.Group.Id, setup.Member.Id, Arg.Any<CancellationToken>()).Returns(true);
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);

        var selfResult = await new SaveSelfSchedulingProfileCommandHandler(db, authorization).Handle(
            new SaveSelfSchedulingProfileCommand(setup.Group.Id, setup.Member.Id, ["welcome"],
                [new SchedulingUnavailableWindowDto([1, 2, 3, 4, 5], "15:00", "17:00", "School pickup")], 1, "Morning is best."),
            CancellationToken.None);
        var forbiddenManagerEdit = await new SaveManagerSchedulingLabelsCommandHandler(db, authorization).Handle(
            new SaveManagerSchedulingLabelsCommand(setup.Group.Id, setup.Member.Id, setup.Member.Id, ["licensed-driver"], null),
            CancellationToken.None);
        var managerResult = await new SaveManagerSchedulingLabelsCommandHandler(db, authorization).Handle(
            new SaveManagerSchedulingLabelsCommand(setup.Group.Id, setup.Member.Id, setup.Leader.Id, ["licensed-driver"], "Confirmed in person."),
            CancellationToken.None);

        Assert.True(selfResult.IsSuccess);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, forbiddenManagerEdit.Status);
        Assert.True(managerResult.IsSuccess);
        Assert.Equal("School pickup", Assert.Single(selfResult.Value!.UnavailableWindows).Reason);
        Assert.Equal(string.Empty, Assert.Single(managerResult.Value!.UnavailableWindows).Reason);
        Assert.Equal(["licensed-driver"], managerResult.Value!.ManagerLabels);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "roster.profile.self.updated" && x.ActorMemberId == setup.Member.Id);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "roster.profile.manager.updated" && x.ActorMemberId == setup.Leader.Id);
    }

    [Fact]
    public async Task Event_without_roster_module_cannot_open_workspace_or_create_shifts()
    {
        await using var db = CreateDbContext();
        var setup = Seed(db);
        setup.Event.EventDataJson = "{\"visibility\":\"groupVisible\",\"enabledModules\":[]}";
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);

        var workspace = await new GetEventRosterWorkspaceQueryHandler(db, authorization)
            .Handle(new GetEventRosterWorkspaceQuery(setup.Event.Id, setup.Leader.Id), CancellationToken.None);
        var planOptions = await new GetEventRosterPlanOptionsQueryHandler(db, authorization)
            .Handle(new GetEventRosterPlanOptionsQuery(setup.Event.Id, setup.Leader.Id), CancellationToken.None);
        var shift = await new SaveRosterShiftCommandHandler(db, authorization).Handle(
            new SaveRosterShiftCommand(setup.Event.Id, null, setup.Leader.Id, "welcome", "Welcome", "接待",
                setup.Event.StartDate, setup.Event.EndDate, 1, [], null), CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, workspace.Status);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, planOptions.Status);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, shift.Status);
        Assert.Empty(await db.EventRosterShifts.ToListAsync());
    }

    [Fact]
    public async Task Manager_assisted_constraints_only_apply_after_confirmation_and_keep_private_reasons_out_of_suggestions()
    {
        await using var db = CreateDbContext();
        var setup = Seed(db);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        var profiles = new SaveManagerSchedulingLabelsCommandHandler(db, authorization);
        var privateReason = "Needs to collect a child from school";
        var window = new SchedulingUnavailableWindowDto([1], "15:00", "17:00", privateReason);

        var pending = await profiles.Handle(new SaveManagerSchedulingLabelsCommand(
            setup.Group.Id, setup.Member.Id, setup.Leader.Id, [], null, [window], "pending", string.Empty), CancellationToken.None);
        var shift = await new SaveRosterShiftCommandHandler(db, authorization).Handle(new SaveRosterShiftCommand(
            setup.Event.Id, null, setup.Leader.Id, "welcome", "Welcome", "接待",
            setup.Event.StartDate, setup.Event.EndDate, 1, [], null), CancellationToken.None);
        var suggestionHandler = new GetRosterSuggestionsQueryHandler(db, authorization);
        var whilePending = await suggestionHandler.Handle(
            new GetRosterSuggestionsQuery(setup.Event.Id, shift.Value!.Id, setup.Leader.Id), CancellationToken.None);

        Assert.True(pending.IsSuccess);
        Assert.True(whilePending.Value!.Single(x => x.MemberId == setup.Member.Id).Eligible);
        Assert.Contains(whilePending.Value!.Single(x => x.MemberId == setup.Member.Id).Reasons,
            x => x.Code == "manager-profile-review-required");

        var confirmed = await profiles.Handle(new SaveManagerSchedulingLabelsCommand(
            setup.Group.Id, setup.Member.Id, setup.Leader.Id, [], null, [window], "confirmed", "phone",
            DateTime.UtcNow.AddMonths(3)), CancellationToken.None);
        var afterConfirmation = await suggestionHandler.Handle(
            new GetRosterSuggestionsQuery(setup.Event.Id, shift.Value.Id, setup.Leader.Id), CancellationToken.None);
        var candidate = afterConfirmation.Value!.Single(x => x.MemberId == setup.Member.Id);

        Assert.True(confirmed.IsSuccess);
        Assert.Equal("phone", confirmed.Value!.ManagerConfirmationMethod);
        Assert.Equal(string.Empty, Assert.Single(confirmed.Value.ManagerUnavailableWindows).Reason);
        Assert.False(candidate.Eligible);
        var reason = Assert.Single(candidate.Reasons, x => x.Code == "manager-confirmed-unavailable");
        Assert.NotEmpty(reason.Text.En);
        Assert.NotEmpty(reason.Text.Zh);
        Assert.DoesNotContain(privateReason, JsonSerializer.Serialize(candidate), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(privateReason, (await db.GroupMemberSchedulingProfiles.SingleAsync()).ManagerLabelsJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Smart_suggestions_do_not_persist_and_only_human_confirmation_creates_assignment()
    {
        await using var db = CreateDbContext();
        var setup = Seed(db);
        var eligible = NewMember("Available driver");
        db.Members.Add(eligible);
        db.GroupMemberships.Add(NewMembership(setup.Group.Id, eligible.Id));
        db.GroupMemberSchedulingProfiles.AddRange(
            new GroupMemberSchedulingProfile
            {
                GroupId = setup.Group.Id, MemberId = setup.Member.Id,
                UnavailableWindowsJson = JsonSerializer.Serialize(new[] { new SchedulingUnavailableWindowDto([1], "15:00", "17:00", "School pickup") }),
                ManagerLabelsJson = JsonSerializer.Serialize(new[] { "licensed-driver" })
            },
            new GroupMemberSchedulingProfile
            {
                GroupId = setup.Group.Id, MemberId = eligible.Id,
                PreferredRoleKeysJson = JsonSerializer.Serialize(new[] { "driver" }),
                ManagerLabelsJson = JsonSerializer.Serialize(new[] { "licensed-driver" })
            });
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        var shiftResult = await new SaveRosterShiftCommandHandler(db, authorization).Handle(
            new SaveRosterShiftCommand(setup.Event.Id, null, setup.Leader.Id, "driver", "Driver", "司机",
                setup.Event.StartDate, setup.Event.EndDate, 1, ["licensed-driver"], null), CancellationToken.None);
        Assert.True(shiftResult.IsSuccess);

        var suggestions = await new GetRosterSuggestionsQueryHandler(db, authorization).Handle(
            new GetRosterSuggestionsQuery(setup.Event.Id, shiftResult.Value!.Id, setup.Leader.Id), CancellationToken.None);

        Assert.True(suggestions.IsSuccess);
        var candidates = Assert.IsAssignableFrom<IReadOnlyList<RosterCandidateSuggestionDto>>(suggestions.Value);
        Assert.False(candidates.Single(x => x.MemberId == setup.Member.Id).Eligible);
        Assert.True(candidates.Single(x => x.MemberId == eligible.Id).Eligible);
        Assert.Empty(db.EventRosterAssignments);

        var confirmed = await new ConfirmRosterAssignmentCommandHandler(db, authorization).Handle(
            new ConfirmRosterAssignmentCommand(setup.Event.Id, shiftResult.Value.Id, eligible.Id, setup.Leader.Id, true, "Reviewed availability."),
            CancellationToken.None);
        Assert.True(confirmed.IsSuccess);
        Assert.Single(db.EventRosterAssignments);
        Assert.True(confirmed.Value!.BasedOnSmartSuggestion);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "roster.assignment.confirmed" && x.TargetMemberId == eligible.Id);
    }

    [Fact]
    public async Task Assigned_member_accepts_personally_and_material_shift_changes_require_a_new_response()
    {
        await using var db = CreateDbContext();
        var setup = Seed(db);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        authorization.IsApprovedMemberAsync(setup.Group.Id, setup.Member.Id, Arg.Any<CancellationToken>()).Returns(true);
        var shifts = new SaveRosterShiftCommandHandler(db, authorization);
        var shift = await shifts.Handle(new SaveRosterShiftCommand(
            setup.Event.Id, null, setup.Leader.Id, "welcome", "Welcome", "接待",
            setup.Event.StartDate, setup.Event.EndDate, 1, [], null), CancellationToken.None);
        var confirmed = await new ConfirmRosterAssignmentCommandHandler(db, authorization).Handle(
            new ConfirmRosterAssignmentCommand(setup.Event.Id, shift.Value!.Id, setup.Member.Id, setup.Leader.Id, true, null),
            CancellationToken.None);

        var responses = new RespondRosterAssignmentCommandHandler(db, authorization);
        var forbidden = await responses.Handle(
            new RespondRosterAssignmentCommand(setup.Event.Id, confirmed.Value!.Id, setup.Leader.Id, EventRosterMemberResponse.Accept, null),
            CancellationToken.None);
        var response = await responses.Handle(
            new RespondRosterAssignmentCommand(setup.Event.Id, confirmed.Value!.Id, setup.Member.Id, EventRosterMemberResponse.Accept, null),
            CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, forbidden.Status);
        Assert.True(response.IsSuccess);
        Assert.Equal(EventRosterAssignmentStatus.Accepted, response.Value!.Status);
        Assert.NotNull(response.Value.RespondedUtc);
        Assert.Equal(EventModuleStatus.Ready, RosterPolicy.RosterModuleStatus(
            await db.EventRosterShifts.Include(x => x.Assignments).Where(x => x.EventId == setup.Event.Id).ToListAsync()));

        var changed = await shifts.Handle(new SaveRosterShiftCommand(
            setup.Event.Id, shift.Value.Id, setup.Leader.Id, "welcome", "Welcome", "接待",
            setup.Event.StartDate.AddMinutes(10), setup.Event.EndDate, 1, [], null), CancellationToken.None);

        Assert.True(changed.IsSuccess);
        var assignment = await db.EventRosterAssignments.SingleAsync();
        Assert.Equal(EventRosterAssignmentStatus.Confirmed, assignment.Status);
        Assert.Null(assignment.RespondedUtc);
        Assert.Equal(EventModuleStatus.Configuring, RosterPolicy.RosterModuleStatus(
            await db.EventRosterShifts.Include(x => x.Assignments).Where(x => x.EventId == setup.Event.Id).ToListAsync()));
        Assert.Contains(await db.NotificationMessages.ToListAsync(), x => x.ActionType == "event.roster.assignment.changed");
    }

    [Fact]
    public async Task Suggestions_balance_recent_service_and_show_same_role_history()
    {
        await using var db = CreateDbContext();
        var setup = Seed(db);
        var fresh = NewMember("Fresh volunteer");
        db.Members.Add(fresh);
        db.GroupMemberships.Add(NewMembership(setup.Group.Id, fresh.Id));
        var previousEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = setup.Group.Id, CreatedByMemberId = setup.Leader.Id,
            TitleEn = "Previous community day", TitleZh = "往期社区活动",
            StartDate = setup.Event.StartDate.AddDays(-30), EndDate = setup.Event.EndDate.AddDays(-30),
            EventDataJson = "{\"visibility\":\"groupVisible\"}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        var previousShift = new EventRosterShift
        {
            Id = Guid.NewGuid(), EventId = previousEvent.Id, RoleKey = "welcome", NameEn = "Welcome", NameZh = "接待",
            StartUtc = previousEvent.StartDate, EndUtc = previousEvent.EndDate, RequiredPeople = 1,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        previousShift.Assignments.Add(new EventRosterAssignment
        {
            Id = Guid.NewGuid(), ShiftId = previousShift.Id, MemberId = setup.Member.Id, ConfirmedByMemberId = setup.Leader.Id,
            Status = EventRosterAssignmentStatus.Accepted, ConfirmedUtc = previousEvent.StartDate.AddDays(-1),
            RespondedUtc = previousEvent.StartDate.AddDays(-1), UpdatedUtc = previousEvent.StartDate.AddDays(-1)
        });
        db.AddRange(previousEvent, previousShift);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        var currentShift = await new SaveRosterShiftCommandHandler(db, authorization).Handle(
            new SaveRosterShiftCommand(setup.Event.Id, null, setup.Leader.Id, "welcome", "Welcome", "接待",
                setup.Event.StartDate, setup.Event.EndDate, 1, [], null), CancellationToken.None);

        var result = await new GetRosterSuggestionsQueryHandler(db, authorization).Handle(
            new GetRosterSuggestionsQuery(setup.Event.Id, currentShift.Value!.Id, setup.Leader.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var experienced = result.Value!.Single(x => x.MemberId == setup.Member.Id);
        var freshCandidate = result.Value!.Single(x => x.MemberId == fresh.Id);
        Assert.Equal(1, experienced.RecentAssignmentCount);
        Assert.Equal(1, experienced.PastSameRoleCount);
        Assert.NotNull(experienced.LastAssignedUtc);
        Assert.True(freshCandidate.Score > experienced.Score);
    }

    [Fact]
    public async Task Whole_roster_options_compare_fairness_and_experience_without_persisting_proposals()
    {
        await using var db = CreateDbContext();
        var setup = Seed(db);
        for (var weeksAgo = 1; weeksAgo <= 2; weeksAgo++)
        {
            var previousEvent = new GroupEvent
            {
                Id = Guid.NewGuid(), GroupId = setup.Group.Id, CreatedByMemberId = setup.Leader.Id,
                TitleEn = $"Previous week {weeksAgo}", TitleZh = $"往期第 {weeksAgo} 周",
                StartDate = setup.Event.StartDate.AddDays(-7 * weeksAgo), EndDate = setup.Event.EndDate.AddDays(-7 * weeksAgo),
                EventDataJson = "{\"visibility\":\"groupVisible\"}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
            };
            var previousShift = new EventRosterShift
            {
                Id = Guid.NewGuid(), EventId = previousEvent.Id, RoleKey = "welcome", NameEn = "Welcome", NameZh = "接待",
                StartUtc = previousEvent.StartDate, EndUtc = previousEvent.EndDate, RequiredPeople = 1,
                CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
            };
            previousShift.Assignments.Add(new EventRosterAssignment
            {
                Id = Guid.NewGuid(), ShiftId = previousShift.Id, MemberId = setup.Member.Id,
                ConfirmedByMemberId = setup.Leader.Id, Status = EventRosterAssignmentStatus.Accepted,
                ConfirmedUtc = previousEvent.StartDate.AddDays(-1), RespondedUtc = previousEvent.StartDate.AddDays(-1),
                UpdatedUtc = previousEvent.StartDate.AddDays(-1)
            });
            db.AddRange(previousEvent, previousShift);
        }
        var first = new EventRosterShift
        {
            Id = Guid.NewGuid(), EventId = setup.Event.Id, RoleKey = "welcome", NameEn = "Welcome", NameZh = "接待",
            StartUtc = setup.Event.StartDate, EndUtc = setup.Event.EndDate, RequiredPeople = 2,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        var overlapping = new EventRosterShift
        {
            Id = Guid.NewGuid(), EventId = setup.Event.Id, RoleKey = "setup", NameEn = "Setup", NameZh = "布置",
            StartUtc = setup.Event.StartDate.AddMinutes(15), EndUtc = setup.Event.EndDate, RequiredPeople = 2,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        db.AddRange(first, overlapping);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventRosterPlanOptionsQueryHandler(db, authorization).Handle(
            new GetEventRosterPlanOptionsQuery(setup.Event.Id, setup.Leader.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.Schemes.Count);
        var balanced = result.Value.Schemes.Single(x => x.Key == "balanced");
        var experienced = result.Value.Schemes.Single(x => x.Key == "experienced");
        Assert.Equal(2, balanced.FilledCount);
        Assert.Equal(2, balanced.UnfilledCount);
        Assert.Contains(balanced.Shifts, x => x.UnfilledCount > 0 && x.GapExplanation is not null);
        Assert.Equal(2, experienced.Shifts.SelectMany(x => x.SuggestedAssignments).Select(x => x.MemberId).Distinct().Count());
        var experiencedMember = experienced.Shifts.SelectMany(x => x.SuggestedAssignments)
            .Single(x => x.MemberId == setup.Member.Id);
        Assert.Equal(2, experiencedMember.ConsecutiveServiceWeeks);
        Assert.Equal(2, experiencedMember.PastSameRoleCount);
        Assert.Equal(setup.Leader.Id, balanced.Shifts.Single(x => x.ShiftId == first.Id).SuggestedAssignments.First().MemberId);
        Assert.Equal(setup.Member.Id, experienced.Shifts.Single(x => x.ShiftId == first.Id).SuggestedAssignments.First().MemberId);
        Assert.Empty(await db.EventRosterAssignments.Where(x => x.Shift.EventId == setup.Event.Id).ToListAsync());
    }

    [Fact]
    public async Task Expiring_catalog_qualification_requires_leader_and_blocks_suggestions_after_expiry()
    {
        await using var db = CreateDbContext();
        var setup = Seed(db);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        var capabilities = new SaveRosterCapabilityCommandHandler(db, authorization);

        var forbidden = await capabilities.Handle(new SaveRosterCapabilityCommand(
            setup.Group.Id, null, setup.Member.Id, "first-aid", "First aid", "急救资格", "Current certificate", "有效证书",
            true, 365, true), CancellationToken.None);
        var created = await capabilities.Handle(new SaveRosterCapabilityCommand(
            setup.Group.Id, null, setup.Leader.Id, "first-aid", "First aid", "急救资格", "Current certificate", "有效证书",
            true, 365, true), CancellationToken.None);
        var profile = new GroupMemberSchedulingProfile
        {
            GroupId = setup.Group.Id,
            MemberId = setup.Member.Id,
            ManagerUpdatedUtc = DateTime.UtcNow,
            ManagerLabelsJson = RosterPolicy.WriteManagerProfile(new ManagerSchedulingProfileDto(
                ["first-aid"], [], "confirmed", "inPerson", DateTime.UtcNow, null,
                [new ManagerQualificationDto("first-aid", DateTime.UtcNow.AddDays(30))]))
        };
        db.GroupMemberSchedulingProfiles.Add(profile);
        await db.SaveChangesAsync();
        var shift = await new SaveRosterShiftCommandHandler(db, authorization).Handle(new SaveRosterShiftCommand(
            setup.Event.Id, null, setup.Leader.Id, "first-aid", "First aider", "急救员",
            setup.Event.StartDate, setup.Event.EndDate, 1, ["first-aid"], null), CancellationToken.None);
        var suggestions = new GetRosterSuggestionsQueryHandler(db, authorization);

        var whileValid = await suggestions.Handle(
            new GetRosterSuggestionsQuery(setup.Event.Id, shift.Value!.Id, setup.Leader.Id), CancellationToken.None);
        profile.ManagerLabelsJson = RosterPolicy.WriteManagerProfile(new ManagerSchedulingProfileDto(
            ["first-aid"], [], "confirmed", "inPerson", DateTime.UtcNow, null,
            [new ManagerQualificationDto("first-aid", DateTime.UtcNow.AddDays(-1))]));
        await db.SaveChangesAsync();
        var afterExpiry = await suggestions.Handle(
            new GetRosterSuggestionsQuery(setup.Event.Id, shift.Value.Id, setup.Leader.Id), CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, forbidden.Status);
        Assert.True(created.IsSuccess);
        Assert.True(whileValid.Value!.Single(x => x.MemberId == setup.Member.Id).Eligible);
        var expiredCandidate = afterExpiry.Value!.Single(x => x.MemberId == setup.Member.Id);
        Assert.False(expiredCandidate.Eligible);
        Assert.Contains(expiredCandidate.Reasons, x => x.Code == "required-qualification-expired");
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "roster.capability.created");
    }

    private static AlifeDbContext CreateDbContext() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static TestSetup Seed(AlifeDbContext db)
    {
        var group = new Group { Id = Guid.NewGuid(), NameJson = "{\"en\":\"Group\"}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var leader = NewMember("Leader");
        var member = NewMember("Parent volunteer");
        var start = new DateTime(2026, 9, 7, 15, 30, 0, DateTimeKind.Utc); // Monday
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = leader.Id,
            TitleEn = "Community day", TitleZh = "社区活动", StartDate = start, EndDate = start.AddHours(1),
            EventDataJson = "{\"visibility\":\"groupVisible\",\"requiresRoster\":true}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        db.AddRange(group, leader, member, NewMembership(group.Id, leader.Id, MembershipRole.Leader), NewMembership(group.Id, member.Id), groupEvent);
        return new TestSetup(group, leader, member, groupEvent);
    }

    private static Member NewMember(string name) => new()
    {
        Id = Guid.NewGuid(), DisplayName = name, IsRegistered = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static GroupMembership NewMembership(Guid groupId, Guid memberId, MembershipRole role = MembershipRole.Member) => new()
    {
        Id = Guid.NewGuid(), GroupId = groupId, MemberId = memberId, Status = MembershipStatus.Approved, Role = role,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private sealed record TestSetup(Group Group, Member Leader, Member Member, GroupEvent Event);
}
