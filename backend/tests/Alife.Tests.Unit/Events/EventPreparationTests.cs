using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    private static async Task<EventPackageDto> ApprovePreparationAsync(EventPackageService service, Seeded seeded, string key = "first")
    {
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, key + "-generate", default);
        Assert.True(generated.IsSuccess, generated.Message);
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner, generated.Value.ETag, key + "-submit", default);
        Assert.True(submitted.IsSuccess, submitted.Message);
        var approved = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.Approve, new("Ready", "已就绪")), submitted.Value!.ETag, key + "-approve", default);
        Assert.True(approved.IsSuccess, approved.Message);
        return approved.Value!;
    }

    [Fact]
    public async Task Preparation_ReopeningRetainsHistoryWithdrawsPublicationAndAllowsFreshApproval()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        var cache = Substitute.For<IEventCacheInvalidationService>(); var service = new EventPackageService(db, Authorization(), cache);
        var approved = await ApprovePreparationAsync(service, seeded);
        var originalDecisions = await db.EventPackageDecisions.CountAsync();
        seeded.Event.PublicationStatus = EventPublicationStatus.Published; seeded.Event.PublishedPackageId = approved.Id;
        seeded.Event.RegistrationStatus = EventRegistrationStatus.Open;
        seeded.Occurrences[0].ExecutionStatus = EventExecutionStatus.Confirmed;
        db.EventEnrollments.Add(new() { Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = seeded.Owner });
        await db.SaveChangesAsync();
        var requested = await service.RequestPreparationReopenAsync(seeded.Event.Id, seeded.Owner,
            new(new("Change the plan", "需要修改方案")), " reopen-once ", default);
        Assert.True(requested.IsSuccess, requested.Message); Assert.True(requested.Value!.IsFrozen);
        Assert.False(requested.Value.CanEdit); Assert.Equal(EventPublicationStatus.Published, seeded.Event.PublicationStatus);
        var retry = await service.RequestPreparationReopenAsync(seeded.Event.Id, seeded.Owner,
            new(new("Change the plan", "需要修改方案")), "reopen-once", default);
        Assert.Equal(requested.Value.ReopenRequest!.Id, retry.Value!.ReopenRequest!.Id);
        Assert.Single(await db.EventPreparationReopenRequests.ToListAsync());
        var reopened = await service.ReviewPreparationReopenAsync(seeded.Event.Id, requested.Value.ReopenRequest.Id, seeded.Owner,
            new(true, new("Allow the changes", "允许修改")), requested.Value.ReopenRequest.ETag, "approve-reopen", default);
        Assert.True(reopened.IsSuccess, reopened.Message); Assert.True(reopened.Value!.CanEdit);
        Assert.False(reopened.Value.IsFrozen); Assert.False(reopened.Value.IsApproved);
        Assert.Equal(EventPublicationStatus.Draft, seeded.Event.PublicationStatus);
        Assert.Equal(EventRegistrationStatus.Closed, seeded.Event.RegistrationStatus);
        Assert.Equal(EventExecutionStatus.Invalidated, seeded.Occurrences[0].ExecutionStatus);
        Assert.Single(await db.EventEnrollments.ToListAsync());
        Assert.Equal(originalDecisions + 1, await db.EventPackageDecisions.CountAsync());
        Assert.Equal(EventPackageApprovalValidity.Revoked, (await db.EventPackages.FindAsync(approved.Id))!.ApprovalValidityStatus);
        var reviewRetry = await service.ReviewPreparationReopenAsync(seeded.Event.Id, requested.Value.ReopenRequest.Id, seeded.Owner,
            new(true, new("Allow the changes", "允许修改")), requested.Value.ReopenRequest.ETag, "approve-reopen", default);
        Assert.True(reviewRetry.IsSuccess, reviewRetry.Message);
        Assert.Equal(originalDecisions + 1, await db.EventPackageDecisions.CountAsync());
        await cache.Received(1).RemoveGroupEventsAsync(seeded.Event.GroupId, Arg.Any<CancellationToken>());
        var newApproval = await ApprovePreparationAsync(service, seeded, "revised");
        Assert.NotEqual(approved.Id, newApproval.Id);
        Assert.True((await service.GetPreparationAsync(seeded.Event.Id, seeded.Owner, default)).Value!.IsFrozen);
        Assert.Equal(EventPublicationStatus.Draft, seeded.Event.PublicationStatus);
    }

    [Fact]
    public async Task Preparation_RejectedRequestKeepsFreeze_StaleAndDuplicateReviewsCannotChangeIt()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization()); await ApprovePreparationAsync(service, seeded);
        var request = (await service.RequestPreparationReopenAsync(seeded.Event.Id, seeded.Owner, new(new("Edit", "修改")), "request", default)).Value!.ReopenRequest!;
        Assert.Equal(AppResultStatus.PreconditionFailed, (await service.ReviewPreparationReopenAsync(seeded.Event.Id, request.Id, seeded.Owner,
            new(false, new("Keep approved plan", "保留已批方案")), "\"stale\"", "stale", default)).Status);
        var result = await service.ReviewPreparationReopenAsync(seeded.Event.Id, request.Id, seeded.Owner,
            new(false, new("Keep approved plan", "保留已批方案")), request.ETag, "reject", default);
        Assert.True(result.IsSuccess, result.Message); Assert.True(result.Value!.IsFrozen);
        Assert.Equal(EventPreparationReopenStatus.Rejected, result.Value.ReopenRequest!.Status);
        Assert.Equal(AppResultStatus.Conflict, (await service.ReviewPreparationReopenAsync(seeded.Event.Id, request.Id, seeded.Owner,
            new(true, new("Different", "不同请求")), request.ETag, "reject", default)).Status);
        Assert.True((await service.RequestPreparationReopenAsync(seeded.Event.Id, seeded.Owner, new(new("Another change", "再次修改")), "request-2", default)).IsSuccess);
    }

    [Fact]
    public async Task Preparation_StandardTierRequiresIndependentEligibleReviewer_AndOutsidersCannotRead()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK", "PEOPLE.REGISTRATION"]);
        var leader = Guid.NewGuid();
        db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = leader, Status = MembershipStatus.Approved, Role = MembershipRole.Leader });
        var service = new EventPackageService(db, Authorization()); await db.SaveChangesAsync();
        var package = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, package.Value!.Id, seeded.Owner, package.Value.ETag, "submit", default);
        Assert.True((await service.DecideAsync(seeded.Event.Id, package.Value.Id, leader, new(EventPackageDecisionType.Approve, new("Ready", "已就绪")), submitted.Value!.ETag, "approve", default)).IsSuccess);
        var requested = await service.RequestPreparationReopenAsync(seeded.Event.Id, seeded.Owner, new(new("Edit", "修改")), "request", default);
        Assert.True(requested.IsSuccess, requested.Message); Assert.False(requested.Value!.ReopenRequest!.CanReview);
        var request = requested.Value.ReopenRequest;
        Assert.Equal(AppResultStatus.Forbidden, (await service.ReviewPreparationReopenAsync(seeded.Event.Id, request.Id, seeded.Owner, new(true, new("Self", "本人")), request.ETag, "self", default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetPreparationAsync(seeded.Event.Id, Guid.NewGuid(), default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.RequestPreparationReopenAsync(seeded.Event.Id, Guid.NewGuid(), new(new("Edit", "修改")), "outsider", default)).Status);
        Assert.True((await service.GetPreparationAsync(seeded.Event.Id, leader, default)).Value!.ReopenRequest!.CanReview);
        Assert.True((await service.ReviewPreparationReopenAsync(seeded.Event.Id, request.Id, leader, new(true, new("Allow", "允许")), request.ETag, "leader-review", default)).IsSuccess);
    }

    [Fact]
    public async Task Preparation_OutdatedRequestCannotRevokeANewerApproval()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization()); var first = await ApprovePreparationAsync(service, seeded);
        var request = (await service.RequestPreparationReopenAsync(seeded.Event.Id, seeded.Owner, new(new("Edit", "修改")), "request", default)).Value!.ReopenRequest!;
        var revoked = await service.RevokeDecisionAsync(seeded.Event.Id, first.Id, first.Decisions[0].Id, seeded.Owner, new(new("Revoke", "撤销")), first.ETag, "direct-revoke", default);
        Assert.True(revoked.IsSuccess, revoked.Message);
        var current = await ApprovePreparationAsync(service, seeded, "new");
        var result = await service.ReviewPreparationReopenAsync(seeded.Event.Id, request.Id, seeded.Owner, new(true, new("Allow", "允许")), request.ETag, "stale-approve", default);
        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Equal(EventPackageApprovalValidity.Active, (await db.EventPackages.FindAsync(current.Id))!.ApprovalValidityStatus);
    }

    [Theory]
    [InlineData(EventPackageDecisionType.ReturnForAmendment)]
    [InlineData(EventPackageDecisionType.Reject)]
    public async Task Preparation_SubmittedAndReturnedPlansStayEditable(EventPackageDecisionType decision)
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());
        var package = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, package.Value!.Id, seeded.Owner, package.Value.ETag, "submit", default);
        Assert.True((await service.GetPreparationAsync(seeded.Event.Id, seeded.Owner, default)).Value!.CanEdit);
        Assert.True((await service.DecideAsync(seeded.Event.Id, package.Value.Id, seeded.Owner, new(decision, new("Revise", "请修改")), submitted.Value!.ETag, "return", default)).IsSuccess);
        Assert.True((await service.GetPreparationAsync(seeded.Event.Id, seeded.Owner, default)).Value!.CanEdit);
        Assert.True((await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "regenerate", default)).IsSuccess);
    }

    [Fact]
    public async Task Preparation_ExpiredApprovalStillFreezesButDoesNotAllowPosterOrPublication()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization()); await ApprovePreparationAsync(service, seeded);
        (await db.EventPackageDecisions.SingleAsync()).ExpiresUtc = DateTime.UtcNow.AddSeconds(-1); await db.SaveChangesAsync();
        var state = (await service.GetPreparationAsync(seeded.Event.Id, seeded.Owner, default)).Value!;
        Assert.True(state.IsFrozen); Assert.False(state.CanEdit); Assert.False(state.IsApproved);
        Assert.Equal(AppResultStatus.Conflict, (await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "blocked", default)).Status);
    }

    [Fact]
    public async Task Preparation_DetailUpdatesRejectFrozenAndStaleVersions_AllowOwnerAfterReopening()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var handler = new UpdateGroupEventCommandHandler(db, Authorization(), cache, new EventPackageInvalidationService(db));
        var command = new UpdateGroupEventCommand(seeded.Event.Id, seeded.Owner, "Revised", "已修改", seeded.Event.StartDate, seeded.Event.EndDate, "{\"visibility\":\"groupVisible\"}");
        Assert.Equal(AppResultStatus.PreconditionFailed, (await handler.Handle(command with { IfMatch = "\"2020-01-01T00:00:00Z\"" }, default)).Status);
        Assert.True((await handler.Handle(command, default)).IsSuccess);
        var service = new EventPackageService(db, Authorization()); await ApprovePreparationAsync(service, seeded);
        Assert.Equal(AppResultStatus.Conflict, (await handler.Handle(command with { TitleEn = "Forbidden edit" }, default)).Status);
        db.ChangeTracker.Clear(); Assert.Equal("Revised", (await db.GroupEvents.FindAsync(seeded.Event.Id))!.TitleEn);
    }

    [Fact]
    public async Task Preparation_CopyEditsInvalidateSubmittedSnapshotBeforeDecision()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner, generated.Value.ETag, "submit", default);
        var handler = new UpdateGroupEventCommandHandler(db, Authorization(), Substitute.For<IEventCacheInvalidationService>(), new EventPackageInvalidationService(db));
        Assert.True((await handler.Handle(new(seeded.Event.Id, seeded.Owner, "Revised title", "修改名称", seeded.Event.StartDate, seeded.Event.EndDate, seeded.Event.EventDataJson), default)).IsSuccess);
        var result = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner, new(EventPackageDecisionType.Approve, new("Ready", "已就绪")), submitted.Value!.ETag, "approve-stale", default);
        Assert.Equal(AppResultStatus.Conflict, result.Status); Assert.Equal("event.package.sourceChanged", result.Message);
    }

    [Theory]
    [InlineData(EventPackageEnforcementMode.Off)]
    [InlineData(EventPackageEnforcementMode.DryRun)]
    [InlineData(EventPackageEnforcementMode.Enforced)]
    public async Task Preparation_ExplicitPublicationAlwaysRequiresApproval(EventPackageEnforcementMode mode)
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        seeded.Event.PublicationStatus = EventPublicationStatus.Draft;
        (await db.EventPackageGovernancePolicyVersions.SingleAsync()).EnforcementMode = mode;
        db.EventRamAssessments.Add(new() { EventId = seeded.Event.Id, Status = EventRamStatus.Approved, RamDataJson = "{}" });
        await db.SaveChangesAsync(); var service = new EventPackageService(db, Authorization());
        var lifecycle = (await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default)).Value!;
        var missing = await service.PublishAsync(seeded.Event.Id, seeded.Owner, new(null, null, lifecycle.ETag), "no-package", default);
        Assert.Equal(AppResultStatus.Conflict, missing.Status);
        Assert.Equal("event.publish.packageMissing", missing.Message);
        var draft = (await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "draft", default)).Value!;
        var blocked = await service.PublishAsync(seeded.Event.Id, seeded.Owner, new(draft.Id, draft.ETag, lifecycle.ETag), "draft-package", default);
        Assert.Equal(AppResultStatus.Conflict, blocked.Status); Assert.Equal("event.publish.packageNotApproved", blocked.Message);
        var approved = await ApprovePreparationAsync(service, seeded);
        lifecycle = (await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default)).Value!;
        Assert.Equal(EventPublicationStatus.Draft, lifecycle.PublicationStatus);
        var published = await service.PublishAsync(seeded.Event.Id, seeded.Owner, new(approved.Id, approved.ETag, lifecycle.ETag), "publish-approved", default);
        Assert.True(published.IsSuccess, published.Message);
        Assert.Equal(EventPackageEnforcementMode.Enforced, seeded.Event.PublicationGateMode);
    }

    [Fact]
    public async Task Preparation_SavedVisibilityAndRegistrationRequirePlanReviewAndCannotBeRestoredFromOldFacts()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, false, ["TEAM.WORK"]);
        seeded.Event.PublicationStatus = EventPublicationStatus.Draft;
        seeded.Event.EventDataJson = "{\"visibility\":\"public\",\"maxCapacity\":30}";
        var input = new EventPlanComposeRequest("1.1.0", "simple-social", new([
            new("visibility", System.Text.Json.JsonSerializer.SerializeToElement("groupVisible"), EventFactCertainty.Confirmed, EventFactSource.Human),
            new("people.registrationMode", System.Text.Json.JsonSerializer.SerializeToElement("none"), EventFactCertainty.Confirmed, EventFactSource.Human)]), [], null, "shared-meal");
        Assert.True(EventPreparationPolicy.NeedsPlanReview(seeded.Event, seeded.Plan.Plan with { Facts = new(null, input.Facts.Items, "old") }));
        var updated = EventPreparationPolicy.WithSavedDetails(seeded.Event, input);
        Assert.Equal("public", updated.Facts.Items.Single(x => x.Code == "visibility").Value!.Value.GetString());
        Assert.Equal("required", updated.Facts.Items.Single(x => x.Code == "people.registrationMode").Value!.Value.GetString());
        Assert.False(EventPreparationPolicy.NeedsPlanReview(seeded.Event, seeded.Plan.Plan with { Facts = new(null, updated.Facts.Items, "new") }));
    }

    [Fact]
    public async Task PreparationController_IsPrivateNoStoreAndRejectsAnonymousAccess()
    {
        var controller = new EventPreparationController(Substitute.For<IEventPackageService>(), Substitute.For<ICurrentMemberAccessor>())
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        Assert.IsType<UnauthorizedResult>(await controller.Get(Guid.NewGuid(), default));
        Assert.Contains("private", controller.Response.Headers.CacheControl.ToString());
        Assert.Contains("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", controller.Response.Headers.Vary.ToString());
    }
}
