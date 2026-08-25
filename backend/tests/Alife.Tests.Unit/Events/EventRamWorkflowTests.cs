using Alife.Application.Admin;
using Alife.Application.Events.Commands.ApproveEventRam;
using Alife.Application.Events.Commands.SaveEventRam;
using Alife.Application.Events.Commands.SubmitEventRam;
using Alife.Application.Events.Commands.ReturnEventRam;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Queries.GetEventPlan;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class EventRamWorkflowTests
{
    private const string ValidRamJson = """
        {
          "activityName":{"zh":"家庭活动","en":"Family activity"},
          "activityDescription":{"zh":"小组家庭活动","en":"A group family activity"},
          "participantCount":20,
          "participantAgeRange":{"zh":"所有年龄","en":"All ages"},
          "isOuting":false,
          "hazards":[{
            "hazard":{"zh":"滑倒","en":"Slips"},
            "likelihood":2,
            "impact":2,
            "riskScore":4,
            "controlMeasures":{"zh":"保持通道干燥","en":"Keep walkways dry"},
            "personResponsible":"Confirmed Leader"
          }],
          "emergencyContacts":[{
            "role":{"zh":"活动负责人","en":"Event lead"},
            "name":"Confirmed Leader",
            "phone":"0210000000"
          }],
          "outingSafety":{
            "transportRequired":null,
            "licensedDriverConfirmed":null,
            "vehicleRegistrationConfirmed":null,
            "vehicleWofConfirmed":null,
            "venueRiskAssessed":null,
            "firstAidKitAvailable":null,
            "trainedFirstAiderName":"",
            "trainedFirstAiderQualificationConfirmed":null,
            "participantHealthNeedsReviewed":null,
            "weatherPlanReviewed":null
          },
          "missingInformation":[],
          "leaderConfirmed":true
        }
        """;

    [Fact]
    public void ValidateForReview_RejectsMissingSensitiveFacts()
    {
        var invalid = ValidRamJson
            .Replace("Confirmed Leader", string.Empty, StringComparison.Ordinal)
            .Replace("0210000000", string.Empty, StringComparison.Ordinal);

        var errors = EventRamPolicy.ValidateForReview(invalid);

        Assert.Contains(errors, error => error.Contains("personResponsible", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("phone", StringComparison.Ordinal));
    }

    [Fact]
    public async Task SaveEventRam_WhenPreviouslyApproved_ResetsStatusToDraft()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var groupEvent = CreateEvent(groupId, leaderId, EventRamStatus.Approved);
        dbContext.GroupEvents.Add(groupEvent);
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var handler = new SaveEventRamCommandHandler(dbContext, authorization, cache);

        var result = await handler.Handle(new SaveEventRamCommand(groupEvent.Id, leaderId, ValidRamJson), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EventRamStatus.Draft, result.Value!.Status);
        Assert.Null(result.Value.ApprovedByMemberId);
    }

    [Fact]
    public async Task SubmitThenApproveRam_UsesSeparateLeaderAndAuditorPermissions()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var auditorId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Members.AddRange(
            new Member { Id = leaderId, DisplayName = "Event Leader" },
            new Member { Id = auditorId, DisplayName = "RAM Auditor" },
            new Member { Id = memberId, DisplayName = "Member" });
        var role = new PlatformRole
        {
            Id = 901,
            Code = "event_auditor",
            NameJson = "{}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions([AdminPermissionCatalog.AuditEvents]),
            Level = 5
        };
        dbContext.PlatformRoles.Add(role);
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = auditorId,
            RoleId = role.Id,
            AssignedUtc = DateTime.UtcNow
        });
        dbContext.GroupMemberships.AddRange(
            new GroupMembership { Id = Guid.NewGuid(), GroupId = groupId, MemberId = leaderId, Status = MembershipStatus.Approved, Role = MembershipRole.Leader, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow },
            new GroupMembership { Id = Guid.NewGuid(), GroupId = groupId, MemberId = memberId, Status = MembershipStatus.Approved, Role = MembershipRole.Member, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        var groupEvent = CreateEvent(groupId, leaderId, EventRamStatus.Draft);
        groupEvent.RamAssessment!.RamDataJson = ValidRamJson;
        dbContext.GroupEvents.Add(groupEvent);
        await dbContext.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var submitHandler = new SubmitEventRamCommandHandler(dbContext, authorization, cache);
        var approveHandler = new ApproveEventRamCommandHandler(dbContext, cache);

        var submitted = await submitHandler.Handle(new SubmitEventRamCommand(groupEvent.Id, leaderId), CancellationToken.None);
        var approved = await approveHandler.Handle(new ApproveEventRamCommand(groupEvent.Id, auditorId), CancellationToken.None);

        Assert.True(submitted.IsSuccess);
        Assert.Equal(EventRamStatus.AwaitingReview, submitted.Value!.Status);
        Assert.True(approved.IsSuccess);
        Assert.Equal(EventRamStatus.Approved, approved.Value!.Status);
        Assert.Equal(auditorId, approved.Value.ApprovedByMemberId);
        Assert.Equal(2, await dbContext.NotificationMessages.CountAsync());
        var decision = await dbContext.EventDecisionRecords.SingleAsync();
        Assert.Equal(EventDecisionStatus.Approved, decision.Status);
        Assert.Equal(leaderId, decision.RequestedByMemberId);
        Assert.Equal(auditorId, decision.DecidedByMemberId);
        Assert.Contains(await dbContext.AuditLogs.Select(x => x.Action).ToListAsync(), x => x == "event.ram.review-requested");
        Assert.Contains(await dbContext.AuditLogs.Select(x => x.Action).ToListAsync(), x => x == "event.ram.approved");
    }

    [Fact]
    public async Task Submitter_cannot_approve_their_own_ram()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        dbContext.Members.Add(new Member { Id = leaderId, DisplayName = "Event Leader" });
        GrantAuditor(dbContext, leaderId);
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(), GroupId = groupId, MemberId = leaderId,
            Status = MembershipStatus.Approved, Role = MembershipRole.Leader,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        var groupEvent = CreateEvent(groupId, leaderId, EventRamStatus.Draft);
        dbContext.GroupEvents.Add(groupEvent);
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();

        await new SubmitEventRamCommandHandler(dbContext, authorization, cache)
            .Handle(new SubmitEventRamCommand(groupEvent.Id, leaderId), CancellationToken.None);
        var result = await new ApproveEventRamCommandHandler(dbContext, cache)
            .Handle(new ApproveEventRamCommand(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Equal(EventRamStatus.AwaitingReview, (await dbContext.EventRamAssessments.SingleAsync()).Status);
        Assert.Equal(EventDecisionStatus.Requested, (await dbContext.EventDecisionRecords.SingleAsync()).Status);
    }

    [Fact]
    public async Task Auditor_can_return_ram_with_reason_and_leader_must_confirm_again()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var auditorId = Guid.NewGuid();
        dbContext.Members.AddRange(
            new Member { Id = leaderId, DisplayName = "Event Leader" },
            new Member { Id = auditorId, DisplayName = "RAM Auditor" });
        GrantAuditor(dbContext, auditorId);
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(), GroupId = groupId, MemberId = leaderId,
            Status = MembershipStatus.Approved, Role = MembershipRole.Leader,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        var groupEvent = CreateEvent(groupId, leaderId, EventRamStatus.Draft);
        dbContext.GroupEvents.Add(groupEvent);
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();

        await new SubmitEventRamCommandHandler(dbContext, authorization, cache)
            .Handle(new SubmitEventRamCommand(groupEvent.Id, leaderId), CancellationToken.None);
        var result = await new ReturnEventRamCommandHandler(dbContext, cache)
            .Handle(new ReturnEventRamCommand(groupEvent.Id, auditorId, "Please clarify the child supervision control."), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EventRamStatus.Draft, result.Value!.Status);
        Assert.Contains("\"leaderConfirmed\":false", result.Value.RamDataJson);
        var decision = await dbContext.EventDecisionRecords.SingleAsync();
        Assert.Equal(EventDecisionStatus.Returned, decision.Status);
        Assert.Equal("Please clarify the child supervision control.", decision.DecisionNotes);
        Assert.Equal(auditorId, decision.DecidedByMemberId);
        var planResult = await new GetEventPlanQueryHandler(dbContext, authorization)
            .Handle(new GetEventPlanQuery(groupEvent.Id, leaderId), CancellationToken.None);
        Assert.True(planResult.IsSuccess);
        Assert.Equal(EventDecisionStatus.Returned, planResult.Value!.Decisions.Single().Status);
        Assert.Equal(EventModuleStatus.Blocked, planResult.Value.Modules.Single(x => x.Key == "ram").Status);
    }

    [Fact]
    public async Task Poster_change_preserves_ram_approval_but_location_change_invalidates_it()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var groupEvent = CreateEvent(groupId, leaderId, EventRamStatus.Approved);
        groupEvent.TitleEn = "Community event";
        groupEvent.TitleZh = "社区活动";
        groupEvent.EventDataJson = """{"visibility":"groupVisible","description":{"en":"Community event","zh":"社区活动"},"locationName":{"en":"Main Hall","zh":"主礼堂"},"posterImageUrl":"old.jpg"}""";
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leaderId, ValidRamJson, now);
        var ramModule = groupEvent.Plan.Modules.Single(x => x.ModuleKey == "ram");
        groupEvent.Plan.Decisions.Add(new EventDecisionRecord
        {
            Id = Guid.NewGuid(), EventPlanId = groupEvent.Plan.Id, ModuleInstanceId = ramModule.Id,
            DecisionKey = EventRamDecisionPolicy.DecisionKey, Status = EventDecisionStatus.Approved,
            RequestedByMemberId = Guid.NewGuid(), DecidedByMemberId = Guid.NewGuid(),
            RequestedUtc = now.AddMinutes(-2), DecidedUtc = now.AddMinutes(-1)
        });
        dbContext.GroupEvents.Add(groupEvent);
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var handler = new UpdateGroupEventCommandHandler(dbContext, authorization, cache);

        var posterOnly = await handler.Handle(new UpdateGroupEventCommand(
            groupEvent.Id, leaderId, groupEvent.TitleEn, groupEvent.TitleZh,
            groupEvent.StartDate, groupEvent.EndDate,
            """{"visibility":"groupVisible","description":{"en":"Community event","zh":"社区活动"},"locationName":{"en":"Main Hall","zh":"主礼堂"},"posterImageUrl":"new.jpg"}""",
            RamDataJson: ValidRamJson), CancellationToken.None);

        Assert.True(posterOnly.IsSuccess);
        Assert.Equal(EventRamStatus.Approved, posterOnly.Value!.RamStatus);
        Assert.Equal(EventDecisionStatus.Approved, EventRamDecisionPolicy.Latest(groupEvent.Plan)!.Status);

        var locationChange = await handler.Handle(new UpdateGroupEventCommand(
            groupEvent.Id, leaderId, groupEvent.TitleEn, groupEvent.TitleZh,
            groupEvent.StartDate, groupEvent.EndDate,
            """{"visibility":"groupVisible","description":{"en":"Community event","zh":"社区活动"},"locationName":{"en":"Outdoor Field","zh":"户外场地"},"posterImageUrl":"new.jpg"}""",
            RamDataJson: ValidRamJson), CancellationToken.None);

        Assert.True(locationChange.IsSuccess);
        Assert.Equal(EventRamStatus.Draft, locationChange.Value!.RamStatus);
        Assert.Equal(EventDecisionStatus.Cancelled, (await dbContext.EventDecisionRecords.OrderByDescending(x => x.RequestedUtc).FirstAsync()).Status);
        Assert.Contains(await dbContext.AuditLogs.Select(x => x.Action).ToListAsync(), x => x == "event.ram.review-invalidated");
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static void GrantAuditor(AlifeDbContext dbContext, Guid memberId)
    {
        var role = new PlatformRole
        {
            Id = 901,
            Code = "event_auditor",
            NameJson = "{}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions([AdminPermissionCatalog.AuditEvents]),
            Level = 5
        };
        dbContext.PlatformRoles.Add(role);
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(), MemberId = memberId, RoleId = role.Id, AssignedUtc = DateTime.UtcNow
        });
    }

    private static GroupEvent CreateEvent(Guid groupId, Guid leaderId, EventRamStatus status)
    {
        var now = DateTime.UtcNow;
        return new GroupEvent
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            CreatedByMemberId = leaderId,
            TitleEn = "Safe event",
            TitleZh = "安全活动",
            StartDate = now.AddDays(1),
            EndDate = now.AddDays(1).AddHours(2),
            EventDataJson = "{}",
            CreatedUtc = now,
            UpdatedUtc = now,
            RamAssessment = new EventRamAssessment
            {
                RamDataJson = ValidRamJson,
                Status = status,
                CreatedUtc = now,
                UpdatedUtc = now
            }
        };
    }
}
