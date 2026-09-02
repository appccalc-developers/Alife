using Alife.Application.Admin;
using Alife.Application.Events.Commands.ApproveEventRam;
using Alife.Application.Events.Commands.SaveEventRam;
using Alife.Application.Events.Commands.SubmitEventRam;
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
        var handler = new SaveEventRamCommandHandler(dbContext, authorization, cache,
            new EventPackageInvalidationService(dbContext));

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
        var invalidation = new EventPackageInvalidationService(dbContext);
        var submitHandler = new SubmitEventRamCommandHandler(dbContext, authorization, cache, invalidation);
        var approveHandler = new ApproveEventRamCommandHandler(dbContext, cache, invalidation);

        var submitted = await submitHandler.Handle(new SubmitEventRamCommand(groupEvent.Id, leaderId), CancellationToken.None);
        var approved = await approveHandler.Handle(new ApproveEventRamCommand(groupEvent.Id, auditorId), CancellationToken.None);

        Assert.True(submitted.IsSuccess);
        Assert.Equal(EventRamStatus.AwaitingReview, submitted.Value!.Status);
        Assert.True(approved.IsSuccess);
        Assert.Equal(EventRamStatus.Approved, approved.Value!.Status);
        Assert.Equal(auditorId, approved.Value.ApprovedByMemberId);
        Assert.Equal(2, await dbContext.NotificationMessages.CountAsync());
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
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
