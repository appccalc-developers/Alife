using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.SaveEventPoster;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class EventPosterTests
{
    private static AlifeDbContext Database() => new(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static GroupEvent Event() => new() { Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), AccountableOwnerMemberId = Guid.NewGuid(),
        TitleEn = "Meal", TitleZh = "聚餐", StartDate = DateTime.UtcNow.AddDays(3), EndDate = DateTime.UtcNow.AddDays(3).AddHours(2),
        EventDataJson = "{\"description\":{\"en\":\"Together\",\"zh\":\"相聚\"},\"maxCapacity\":30,\"visibility\":\"groupVisible\",\"posterImageUrl\":null,\"privateContact\":\"do not expose\"}",
        PublicationStatus = EventPublicationStatus.Draft, PlanConcurrencyToken = Guid.NewGuid(), UpdatedUtc = DateTime.UtcNow,
        EventPackages = [new() { Id = Guid.NewGuid(), Version = 1, Status = EventPackageStatus.Approved,
            ApprovalValidityStatus = EventPackageApprovalValidity.Active,
            Decisions = [new() { Id = Guid.NewGuid(), DecisionType = EventPackageDecisionType.Approve,
                DecidedUtc = DateTime.UtcNow, EffectiveUtc = DateTime.UtcNow, ExpiresUtc = DateTime.UtcNow.AddDays(7) }] }] };

    [Theory]
    [InlineData(EventPackageApprovalValidity.NotDecided)]
    [InlineData(EventPackageApprovalValidity.Revoked)]
    [InlineData(EventPackageApprovalValidity.Invalidated)]
    public async Task PosterAdoption_RequiresActiveFormalApproval(EventPackageApprovalValidity validity)
    {
        await using var db = Database(); var item = Event(); item.EventPackages.Single().ApprovalValidityStatus = validity;
        db.GroupEvents.Add(item); await db.SaveChangesAsync();
        var handler = new EventPosterHandler(db, Substitute.For<IGroupAuthorizationService>(), Substitute.For<IEventCacheInvalidationService>());
        var info = (await handler.Handle(new GetEventPosterQuery(item.Id, item.AccountableOwnerMemberId), default)).Value!;
        var result = await handler.Handle(new SaveEventPosterCommand(item.Id, item.AccountableOwnerMemberId, "https://example.org/poster.png", info.ETag, "before-approval"), default);
        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Empty(await db.EventIdempotencyRecords.ToListAsync());
    }

    [Fact]
    public async Task PosterOnlySave_PreservesOtherDataAndApprovals_IsIdempotent_AndInvalidatesGroupCache()
    {
        await using var db = Database(); var item = Event();
        item.RamAssessment = new() { EventId = item.Id, Status = EventRamStatus.Approved, RamDataJson = "{\"leaderConfirmed\":true}" };
        db.GroupEvents.Add(item); await db.SaveChangesAsync();
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var handler = new EventPosterHandler(db, Substitute.For<IGroupAuthorizationService>(), cache);
        var workspace = (await handler.Handle(new GetEventPosterQuery(item.Id, item.AccountableOwnerMemberId), default)).Value!;
        Assert.True(workspace.CanManage); Assert.Equal("required", workspace.RegistrationMode);
        Assert.DoesNotContain("do not expose", JsonSerializer.Serialize(workspace));
        var beforeToken = item.PlanConcurrencyToken;
        var beforeGovernanceHash = EventPackageCanonicalizer.HashGovernanceEventData(item.EventDataJson);
        var command = new SaveEventPosterCommand(item.Id, item.AccountableOwnerMemberId, "https://example.org/poster.png", workspace.ETag, "poster-once");
        var saved = await handler.Handle(command, default); var retry = await handler.Handle(command, default);
        Assert.True(saved.IsSuccess); Assert.True(retry.IsSuccess); Assert.Equal(saved.Value!.ETag, retry.Value!.ETag);
        Assert.Equal(beforeToken, item.PlanConcurrencyToken);
        Assert.Equal(beforeGovernanceHash, EventPackageCanonicalizer.HashGovernanceEventData(item.EventDataJson));
        using var data = JsonDocument.Parse(item.EventDataJson);
        Assert.Equal(30, data.RootElement.GetProperty("maxCapacity").GetInt32());
        Assert.Equal("do not expose", data.RootElement.GetProperty("privateContact").GetString());
        Assert.Equal(EventRamStatus.Approved, item.RamAssessment.Status); Assert.Equal(EventPublicationStatus.Draft, item.PublicationStatus);
        Assert.Single(await db.EventIdempotencyRecords.ToListAsync());
        await cache.Received(1).RemoveGroupEventsAsync(item.GroupId, Arg.Any<CancellationToken>());
        Assert.Equal(AppResultStatus.Conflict, (await handler.Handle(command with { PosterImageUrl = "https://example.org/other.png" }, default)).Status);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await handler.Handle(command with { IdempotencyKey = "another" }, default)).Status);
    }

    [Theory]
    [InlineData("http://example.org/poster.png")]
    [InlineData("javascript:alert(1)")]
    [InlineData("data:image/png;base64,dGVzdA==")]
    [InlineData("https://user:secret@example.org/poster.png")]
    public async Task InvalidPosterUrls_FailWithoutMutatingEvent(string url)
    {
        await using var db = Database(); var item = Event(); db.GroupEvents.Add(item); await db.SaveChangesAsync();
        var original = item.EventDataJson; var handler = new EventPosterHandler(db, Substitute.For<IGroupAuthorizationService>(), Substitute.For<IEventCacheInvalidationService>());
        var workspace = (await handler.Handle(new GetEventPosterQuery(item.Id, item.AccountableOwnerMemberId), default)).Value!;
        var result = await handler.Handle(new SaveEventPosterCommand(item.Id, item.AccountableOwnerMemberId, url, workspace.ETag, "invalid"), default);
        Assert.Equal(AppResultStatus.ValidationError, result.Status); Assert.Equal(original, item.EventDataJson);
        Assert.Empty(await db.EventIdempotencyRecords.ToListAsync());
    }

    [Fact]
    public async Task TeamCanReviewButCannotAdopt_AndOutsiderCannotReadTheDraft()
    {
        await using var db = Database(); var item = Event(); var member = Guid.NewGuid();
        db.GroupEvents.Add(item); db.EventTeamMembers.Add(new() { Id = Guid.NewGuid(), EventId = item.Id, MemberId = member, Status = EventTeamMemberStatus.Accepted });
        await db.SaveChangesAsync(); var handler = new EventPosterHandler(db, Substitute.For<IGroupAuthorizationService>(), Substitute.For<IEventCacheInvalidationService>());
        var team = await handler.Handle(new GetEventPosterQuery(item.Id, member), default);
        Assert.True(team.IsSuccess); Assert.False(team.Value!.CanManage);
        Assert.Equal(AppResultStatus.Forbidden, (await handler.Handle(new SaveEventPosterCommand(item.Id, member, null, team.Value.ETag, "forbidden"), default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await handler.Handle(new GetEventPosterQuery(item.Id, Guid.NewGuid()), default)).Status);
        Assert.Empty(await db.EventIdempotencyRecords.ToListAsync());
    }

    [Fact]
    public async Task ChangedEventBrief_InvalidatesPosterReviewBeforeAdoption()
    {
        await using var db = Database(); var item = Event(); db.GroupEvents.Add(item); await db.SaveChangesAsync();
        var handler = new EventPosterHandler(db, Substitute.For<IGroupAuthorizationService>(), Substitute.For<IEventCacheInvalidationService>());
        var before = (await handler.Handle(new GetEventPosterQuery(item.Id, item.AccountableOwnerMemberId), default)).Value!;
        item.StartDate = item.StartDate.AddHours(1); await db.SaveChangesAsync();
        var result = await handler.Handle(new SaveEventPosterCommand(item.Id, item.AccountableOwnerMemberId, "https://example.org/poster.png", before.ETag, "stale"), default);
        Assert.Equal(AppResultStatus.PreconditionFailed, result.Status);
        Assert.Empty(await db.EventIdempotencyRecords.ToListAsync());
    }

    [Fact]
    public async Task PosterController_DeniesAnonymousAccessWithNoStoreHeaders()
    {
        var controller = new EventPostersController(Substitute.For<IMediator>(), Substitute.For<ICurrentMemberAccessor>())
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        Assert.IsType<UnauthorizedResult>(await controller.Get(Guid.NewGuid(), default));
        Assert.Contains("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Contains("private", controller.Response.Headers.CacheControl.ToString());
        Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", controller.Response.Headers.Vary.ToString());
        Assert.IsType<UnauthorizedResult>(await controller.Put(Guid.NewGuid(), new(null), default));
    }
}
