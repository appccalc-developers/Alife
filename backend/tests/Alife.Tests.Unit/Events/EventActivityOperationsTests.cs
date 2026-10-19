using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventActivityOperationsTests
{
    [Theory]
    [InlineData(2027, 2, 27, 22)]
    [InlineData(2027, 2, 28, 23)]
    [InlineData(2028, 2, 28, 23)]
    [InlineData(2028, 2, 29, 24)]
    public void Age_FollowsLocalCalendarAndLeapBirthday(int year, int month, int day, int expected) =>
        Assert.Equal(expected, EventActivityOperationsService.AgeAt(new(2004, 2, 29), new(year, month, day)));

    [Fact]
    public void AgeDate_UsesEventZoneAndRejectsInvalidZone()
    {
        var utc = new DateTime(2026, 10, 11, 16, 0, 0, DateTimeKind.Utc);
        Assert.Equal(new DateOnly(2026, 10, 12), EventActivityOperationsService.EventLocalDate(utc, "{\"timeZone\":\"Australia/Perth\"}"));
        Assert.Null(EventActivityOperationsService.EventLocalDate(utc, "{\"timeZone\":\"invalid-zone\"}"));
        Assert.Null(EventActivityOperationsService.EventLocalDate(utc, "{\"timeZone\":null}"));
    }

    [Fact]
    public async Task NoneMode_CanSaveDraftButCannotOpenOrSelect()
    {
        await using var f = new Fixture(); await f.Setup(); f.Event.EventDataJson = "{\"registrationMode\":\"none\",\"timeZone\":\"Australia/Perth\"}"; await f.Db.SaveChangesAsync();
        var policy = await f.Service.SavePolicyAsync(f.Event.Id, "a", f.Owner, f.Rules(), EventActivityOperationsService.NewETag, default);
        Assert.True(policy.IsSuccess, policy.Message);
        var offer = await f.Offer("a", f.Occurrences[0]);
        var opened = await f.Service.OfferActionAsync(f.Event.Id, offer.Id, f.Owner, "open", EventActivityOperationsService.ETag(offer.ConcurrencyToken), "none-open", new(), default);
        Assert.Equal(AppResultStatus.Conflict, opened.Status);
        Assert.Equal("draft", offer.Status);
    }

    [Fact]
    public async Task FreeAdultProject_DoesNotRequireExtraConsent_AndUsesIndependentWaitlists()
    {
        await using var f = new Fixture(); await f.Setup();
        var a = await f.Open("a", 1); var b = await f.Open("b", 1);
        var first = await f.Select(f.OwnerPerson, a.Id); await f.Act(first, f.Owner, "complete");
        var next = await f.Select(f.OtherPerson, a.Id); await f.Act(next, f.Other, "complete");
        var independent = await f.Select(f.OtherPerson, b.Id); await f.Act(independent, f.Other, "complete");
        Assert.Equal("confirmed", first.SeatStatus); Assert.Equal("waitlisted", next.SeatStatus); Assert.Equal("confirmed", independent.SeatStatus);
        await f.Act(first, f.Owner, "cancel"); Assert.Equal("confirmed", next.SeatStatus);
        Assert.Empty(await f.Db.EventActivityConsents.ToArrayAsync());
    }

    [Fact]
    public async Task UnlimitedProject_HasNoWaitingQueue()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("a", 0);
        foreach (var person in new[] { f.OwnerPerson, f.OtherPerson }) { var row = await f.Select(person, offer.Id); await f.Act(row, person.MemberId!.Value, "complete"); Assert.Equal("confirmed", row.SeatStatus); }
    }

    [Fact]
    public async Task OnceSeries_QuotesOnce_FreezesPrice_AndPaymentsUseSharedCharge()
    {
        await using var f = new Fixture(); await f.Setup();
        var first = await f.Open("a", 5, 1200, "oncePerSeries"); var second = await f.Offer("a", f.Occurrences[1]); await f.OpenOffer(second);
        var change = new ActivitySelectionRequest(f.OwnerPerson.Id, [first.Id, second.Id], []);
        var preview = await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, change, default); Assert.True(preview.IsSuccess, preview.Message); Assert.Equal(1200, preview.Value!.AddedFeeMinor);
        var applied = await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, new(change, preview.Value.PreviewToken), "series-select", default); Assert.True(applied.IsSuccess, applied.Message);
        var rows = await f.Db.EventActivityParticipations.OrderByDescending(p => p.FeeMinor).ToArrayAsync(); Assert.Equal(1200, rows.Sum(p => p.FeeMinor)); Assert.Equal(rows[0].Id, rows[1].ChargeParticipationId);
        foreach (var row in rows) await f.Act(row, f.Owner, "complete"); Assert.All(rows, row => Assert.Equal("reserved", row.SeatStatus));
        await f.Act(rows[0], f.Owner, "cancel");
        await f.Act(rows[0], f.Finance, "payment", new(Evidence: "Verified bank receipt", AmountMinor: 1200)); Assert.Equal("confirmed", rows[1].SeatStatus);
        var refund = await f.Service.ParticipationActionAsync(f.Event.Id, rows[0].Id, f.Finance, "refund", new(Evidence: "Refund review", AmountMinor: 1200), EventActivityOperationsService.ETag(rows[0].ConcurrencyToken), "early-refund", default);
        Assert.Equal(AppResultStatus.Conflict, refund.Status);
        await f.Act(rows[1], f.Owner, "cancel"); await f.Act(rows[0], f.Finance, "refund", new(Evidence: "Verified refund", AmountMinor: 1200));
        Assert.Equal(2, await f.Db.EventActivityPayments.CountAsync());
    }

    [Fact]
    public async Task PerOccurrence_QuotesEveryOccurrence_AndPolicyChangesDoNotRepriceSavedRows()
    {
        await using var f = new Fixture(); await f.Setup(); var first = await f.Open("a", 5, 1200); var second = await f.Offer("a", f.Occurrences[1]); await f.OpenOffer(second);
        var request = new ActivitySelectionRequest(f.OwnerPerson.Id, [first.Id, second.Id], []);
        var preview = await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, request, default); Assert.Equal(2400, preview.Value!.AddedFeeMinor);
        Assert.True((await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, new(request, preview.Value.PreviewToken), "per-occurrence", default)).IsSuccess);
        var before = await f.Db.EventActivityParticipations.ToArrayAsync(); var oldVersion = before[0].FeePolicyVersionId;
        var policy = await f.Db.EventActivityPolicyVersions.SingleAsync(p => p.IsCurrent && p.ActivityId == "a");
        var changed = await f.Service.SavePolicyAsync(f.Event.Id, "a", f.Owner, f.Rules(5, 2200), EventActivityOperationsService.ETag(policy.ConcurrencyToken), default);
        Assert.True(changed.IsSuccess, changed.Message); Assert.All(before, p => { Assert.Equal(1200, p.FeeMinor); Assert.Equal(oldVersion, p.FeePolicyVersionId); Assert.NotEqual(oldVersion, p.PolicyVersionId); Assert.Equal("reconfirmationRequired", p.ProcedureStatus); });
    }

    [Fact]
    public async Task PreviewRejectsAvailabilityChange_AndRetryDoesNotCreateDuplicateParticipation()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("a", 1);
        var request = new ActivitySelectionRequest(f.OwnerPerson.Id, [offer.Id], []); var preview = await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, request, default);
        offer.ConcurrencyToken = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.PreconditionFailed, (await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, new(request, preview.Value!.PreviewToken), "stale", default)).Status);
        var fresh = await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, request, default); var input = new ApplyActivitySelectionRequest(request, fresh.Value!.PreviewToken);
        Assert.True((await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, input, "safe-retry", default)).IsSuccess);
        Assert.True((await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, input, "safe-retry", default)).IsSuccess); Assert.Equal(1, await f.Db.EventActivityParticipations.CountAsync());
    }

    [Fact]
    public async Task Birthday_IsPrivateToPersonOrConfirmedGuardian_AndNeverInWorkspace()
    {
        await using var f = new Fixture(); await f.Setup(); var child = f.Child(false); await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.GetPrivateDataAsync(f.Event.Id, child.Id, f.Owner, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.SavePrivateDataAsync(f.Event.Id, child.Id, f.Other, new(new(2014, 1, 1)), EventActivityOperationsService.NewETag, default)).Status);
        f.ConfirmGuardian(child); await f.Db.SaveChangesAsync();
        var saved = await f.Service.SavePrivateDataAsync(f.Event.Id, child.Id, f.Other, new(new(2014, 1, 1)), EventActivityOperationsService.NewETag, default); Assert.True(saved.IsSuccess, saved.Message);
        Assert.True((await f.Service.GetPrivateDataAsync(f.Event.Id, child.Id, f.Other, default)).IsSuccess);
        var workspace = await f.Service.GetAsync(f.Event.Id, f.Owner, default); var json = JsonSerializer.Serialize(workspace.Value);
        Assert.DoesNotContain("2014", json); Assert.DoesNotContain("BirthDate", json); Assert.False(workspace.Value!.Participants.Single(p => p.ParticipantId == child.Id).CanProvidePrivateData);
    }

    [Fact]
    public async Task HighRiskChild_RequiresConfirmedGuardianAndCurrentProjectConsent()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("b", 5); var child = f.Child(false); await f.Db.SaveChangesAsync();
        var request = new ActivitySelectionRequest(child.Id, [offer.Id], []);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, request, default)).Status);
        f.ConfirmGuardian(child); await f.Db.SaveChangesAsync();
        var row = await f.Select(child, offer.Id);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Other, "complete", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "missing-project-consent", default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Owner, "consent", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "proxy-consent", default)).Status);
        await f.Act(row, f.Other, "consent"); await f.Act(row, f.Other, "complete"); Assert.Equal("confirmed", row.SeatStatus);
    }

    [Fact]
    public async Task ExternalSpace_RequiresHumanEvidenceAndResourceAuthority()
    {
        await using var f = new Fixture(); await f.Setup(); await f.Policy("a", f.Rules() with { NeedsSpace = true }); var offer = await f.Offer("a", f.Occurrences[0]);
        var request = new SaveActivitySpaceRequest("external", null, new("Park", "公园"), "confirmed");
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.SaveSpaceAsync(f.Event.Id, offer.Id, f.Other, request, EventActivityOperationsService.NewETag, "other-space", default)).Status);
        Assert.Equal(AppResultStatus.ValidationError, (await f.Service.SaveSpaceAsync(f.Event.Id, offer.Id, f.Owner, request, EventActivityOperationsService.NewETag, "missing-evidence", default)).Status);
        var confirmed = await f.Service.SaveSpaceAsync(f.Event.Id, offer.Id, f.Owner, request with { Evidence = "Park permit manually verified" }, EventActivityOperationsService.NewETag, "verified-space", default); Assert.True(confirmed.IsSuccess, confirmed.Message);
        Assert.DoesNotContain("permit", JsonSerializer.Serialize(confirmed.Value)); await f.OpenOffer(offer);
    }

    [Fact]
    public async Task UnlimitedCapacity_CannotConfirmFiniteInternalRoom()
    {
        await using var f = new Fixture(); await f.Setup(); await f.Policy("a", f.Rules(0) with { NeedsSpace = true }); var offer = await f.Offer("a", f.Occurrences[0]);
        var result = await f.Service.SaveSpaceAsync(f.Event.Id, offer.Id, f.Owner, new("internal", Guid.NewGuid(), new("Room", "房间"), "confirmed"), EventActivityOperationsService.NewETag, "unlimited-room", default);
        Assert.Equal(AppResultStatus.ValidationError, result.Status); Assert.Contains("finite", result.Message); Assert.Empty(await f.Db.EventActivitySpaceRequests.ToArrayAsync());
    }

    [Fact]
    public async Task AgeEligibilityAndParentCancellation_PreventProjectParticipation()
    {
        await using var f = new Fixture(); await f.Setup(); await f.Policy("a", f.Rules() with { MinimumAge = 18 }); var offer = await f.Offer("a", f.Occurrences[0]); await f.OpenOffer(offer);
        var child = f.Child(true); await f.Db.SaveChangesAsync();
        Assert.True((await f.Service.SavePrivateDataAsync(f.Event.Id, child.Id, f.Other, new(new(2014, 1, 1)), EventActivityOperationsService.NewETag, default)).IsSuccess);
        var row = await f.Select(child, offer.Id);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Other, "complete", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "age-restricted", default)).Status);
        child.SeatStatus = "cancelled"; await f.Db.SaveChangesAsync(); await f.Service.ReconcileEventAsync(f.Event.Id, default); Assert.Equal("cancelled", row.SeatStatus);
    }

    [Fact]
    public async Task FeeOnlyViewer_CannotSeeEligibilityOrActAsParticipant()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("a", 5); var row = await f.Select(f.OtherPerson, offer.Id);
        var workspace = await f.Service.GetAsync(f.Event.Id, f.Finance, default); Assert.True(workspace.IsSuccess, workspace.Message);
        Assert.False(workspace.Value!.Participants.Single(p => p.ParticipantId == f.OtherPerson.Id).CanSelect);
        var projection = Assert.Single(workspace.Value.Projects.Single(p => p.ActivityId == "a").Participations);
        Assert.Equal("", projection.Eligibility); Assert.Equal("", projection.ProcedureStatus);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Finance, "complete", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "finance-complete", default)).Status);
    }

    [Fact]
    public async Task PolicyAndCancellation_NoticesAreGenericAndIdempotent()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("a", 5); await f.Select(f.OtherPerson, offer.Id);
        var policy = await f.Db.EventActivityPolicyVersions.SingleAsync(p => p.IsCurrent && p.ActivityId == "a");
        Assert.True((await f.Service.SavePolicyAsync(f.Event.Id, "a", f.Owner, f.Rules(6), EventActivityOperationsService.ETag(policy.ConcurrencyToken), default)).IsSuccess);
        var changed = await f.Db.NotificationMessages.SingleAsync(n => n.RecipientMemberId == f.Other && n.ActionType == "event.activity.policyChanged");
        Assert.DoesNotContain("BirthDate", changed.ActionDataJson); Assert.DoesNotContain("AmountMinor", changed.ActionDataJson);
        var input = new ActivityParticipationActionRequest(Evidence: "Private cancellation reason"); var tag = EventActivityOperationsService.ETag(offer.ConcurrencyToken);
        Assert.True((await f.Service.OfferActionAsync(f.Event.Id, offer.Id, f.Owner, "cancel", tag, "cancel-with-notice", input, default)).IsSuccess);
        Assert.True((await f.Service.OfferActionAsync(f.Event.Id, offer.Id, f.Owner, "cancel", tag, "cancel-with-notice", input, default)).IsSuccess);
        var cancelled = await f.Db.NotificationMessages.SingleAsync(n => n.RecipientMemberId == f.Other && n.ActionType == "event.activity.cancelled");
        Assert.DoesNotContain(input.Evidence!, cancelled.ActionDataJson); Assert.Equal("cancelled", (await f.Db.EventActivityParticipations.SingleAsync()).SeatStatus);
    }

    [Fact]
    public async Task ReplacingOnlySeriesSelection_PreviewAndApplyUseSamePostRemovalQuote()
    {
        await using var f = new Fixture(); await f.Setup(); var first = await f.Open("a", 5, 1200, "oncePerSeries"); var second = await f.Offer("a", f.Occurrences[1]); await f.OpenOffer(second);
        var old = await f.Select(f.OwnerPerson, first.Id); await f.Act(old, f.Owner, "complete"); await f.Act(old, f.Finance, "payment", new(Evidence: "Verified receipt", AmountMinor: 1200));
        var change = new ActivitySelectionRequest(f.OwnerPerson.Id, [second.Id], [old.Id]); var preview = await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, change, default);
        Assert.True(preview.IsSuccess, preview.Message); Assert.Equal(1200, preview.Value!.AddedFeeMinor); Assert.Equal(1, preview.Value.RefundReviewCount);
        Assert.True((await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, new(change, preview.Value.PreviewToken), "replace-series", default)).IsSuccess);
        var replacement = await f.Db.EventActivityParticipations.SingleAsync(p => p.OfferId == second.Id);
        Assert.Equal(preview.Value.AddedFeeMinor, replacement.FeeMinor); Assert.Null(replacement.ChargeParticipationId); Assert.Equal("cancelled", old.SeatStatus);
    }

    [Fact]
    public async Task ParticipantView_HidesUnpublishedProjectPolicyAndDraftSpace()
    {
        await using var f = new Fixture(); await f.Setup(); await f.Policy("a", f.Rules()); var offer = await f.Offer("a", f.Occurrences[0]);
        Assert.Empty((await f.Service.GetAsync(f.Event.Id, f.Other, default)).Value!.Projects);
        await f.OpenOffer(offer); await f.Select(f.OtherPerson, offer.Id);
        var saved = await f.Service.SaveSpaceAsync(f.Event.Id, offer.Id, f.Owner, new("external", null, new("Draft location", "筹备地点"), "draft"), EventActivityOperationsService.NewETag, "draft-location", default); Assert.True(saved.IsSuccess, saved.Message);
        var project = Assert.Single((await f.Service.GetAsync(f.Event.Id, f.Other, default)).Value!.Projects);
        Assert.Null(project.Policy); Assert.Null(Assert.Single(project.Offers).Space); Assert.Single(project.Participations);
        var ownerProject = (await f.Service.GetAsync(f.Event.Id, f.Owner, default)).Value!.Projects.Single(p => p.ActivityId == "a"); Assert.NotNull(ownerProject.Policy); Assert.NotNull(Assert.Single(ownerProject.Offers).Space);
    }

    [Fact]
    public async Task ClosingEventRegistration_BlocksCompletingExistingProjectSelection()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("a", 5); var row = await f.Select(f.OwnerPerson, offer.Id);
        f.Event.RegistrationStatus = EventRegistrationStatus.Closed; await f.Db.SaveChangesAsync();
        var result = await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Owner, "complete", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "closed-event", default);
        Assert.Equal(AppResultStatus.Conflict, result.Status); Assert.Equal("incomplete", row.ProcedureStatus);
    }

    [Fact]
    public async Task UnconfirmedEventSeat_CannotPreviewOrApplyProjectSelection()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("a", 5);
        f.OwnerPerson.SeatStatus = "waitlisted"; await f.Db.SaveChangesAsync();
        var request = new ActivitySelectionRequest(f.OwnerPerson.Id, [offer.Id], []);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, request, default)).Status);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, new(request, "invented-token"), "unconfirmed-event", default)).Status);
        Assert.Empty(await f.Db.EventActivityParticipations.ToArrayAsync());
    }

    [Fact]
    public async Task ChildProject_RequiresConfirmedMinorAnswerAndChildModule()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("a", 5); var child = f.Child(true); await f.Db.SaveChangesAsync();
        var request = new ActivitySelectionRequest(child.Id, [offer.Id], []);
        foreach (var answer in new[] { new PlannedActivityAnswer("no", "human", true), new("unknown", "human", true), new("yes", "human", false) })
        {
            await f.ChangeActivity("a", a => a with { Answers = f.ProjectAnswers(answer) });
            Assert.Equal(AppResultStatus.Conflict, (await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, request, default)).Status);
            Assert.Equal(AppResultStatus.Conflict, (await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, new(request, "invalid"), Guid.NewGuid().ToString(), default)).Status);
        }
        await f.ChangeActivity("a", a => a with { Answers = f.ProjectAnswers(new("yes", "human", true)) });
        var row = await f.Select(child, offer.Id);
        await f.ChangeActivity("a", a => a with { Answers = f.ProjectAnswers(new("no", "human", true)) });
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Other, "complete", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "child-disallowed", default)).Status);
    }

    [Fact]
    public async Task ProjectConsent_IsBoundToCurrentAttributesConditionsAndOfferTimes()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("b", 5); var child = f.Child(true); await f.Db.SaveChangesAsync(); var row = await f.Select(child, offer.Id);
        await f.Act(row, f.Other, "consent");
        var proof = await f.Db.EventActivityConsents.SingleAsync(); Assert.Contains("scopeHash", proof.Evidence);
        await f.ChangeActivity("b", a => a with { Conditions = new("Changed route", "路线已变") });
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Other, "complete", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "old-scope", default)).Status);
        await f.Act(row, f.Other, "consent"); await f.Act(row, f.Other, "complete"); Assert.Equal("confirmed", row.SeatStatus);
        Assert.Empty(await EventActivityOperationsService.ExecutionBlockersAsync(f.Db, f.Event.Id, offer.OccurrenceId, default));
        await f.ChangeActivity("b", a => a with { Attributes = ["hiking", "outdoor"] });
        Assert.Contains(EventActivityOperationsService.ChildProjectExecutionBlocked, await EventActivityOperationsService.ExecutionBlockersAsync(f.Db, f.Event.Id, offer.OccurrenceId, default));
        row.ProcedureStatus = "reconfirm"; offer.StartUtc = offer.StartUtc.AddMinutes(1); await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Other, "complete", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "old-time", default)).Status);
        foreach (var consent in await f.Db.EventActivityConsents.ToArrayAsync()) consent.Evidence = "Historical unsigned text";
        await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ParticipationActionAsync(f.Event.Id, row.Id, f.Other, "complete", new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), "old-plain-evidence", default)).Status);
        Assert.Equal(2, await f.Db.EventActivityConsents.CountAsync());
    }

    [Fact]
    public async Task MixedCurrency_CannotOpenPreviewOrApplyProjectFees()
    {
        await using var f = new Fixture(); await f.Setup(); var offer = await f.Open("a", 5, 100); var current = await f.Db.EventActivityPolicyVersions.SingleAsync(p => p.IsCurrent && p.ActivityId == "a");
        var request = new ActivitySelectionRequest(f.OwnerPerson.Id, [offer.Id], []); var preview = await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, request, default); Assert.True(preview.IsSuccess, preview.Message);
        current.RulesJson = RamEvaluator.Serialize(f.Rules(5, 100) with { Currency = "USD" }); await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.PreviewSelectionAsync(f.Event.Id, f.Owner, request, default)).Status);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ApplySelectionAsync(f.Event.Id, f.Owner, new(request, preview.Value!.PreviewToken), "mixed-currency", default)).Status);
        offer.Status = "draft"; await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.OfferActionAsync(f.Event.Id, offer.Id, f.Owner, "open", EventActivityOperationsService.ETag(offer.ConcurrencyToken), "mixed-open", new(), default)).Status);
        Assert.Empty(await f.Db.EventActivityParticipations.ToArrayAsync());
    }

    [Fact]
    public async Task Endpoint_IsPrivateNoStore()
    {
        await using var f = new Fixture(); await f.Setup(); var actor = Substitute.For<ICurrentMemberAccessor>(); actor.GetCurrentMemberId().Returns(f.Owner);
        var controller = new EventActivityOperationsController(f.Service, actor) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
        Assert.IsType<OkObjectResult>(await controller.Get(f.Event.Id, default)); Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Contains("Authorization", controller.Response.Headers.Vary.ToString()); Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public AlifeDbContext Db { get; } = new(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        public Guid Owner { get; } = Guid.NewGuid(); public Guid Other { get; } = Guid.NewGuid(); public Guid Finance { get; } = Guid.NewGuid(); public Guid Approver { get; } = Guid.NewGuid();
        public GroupEvent Event { get; private set; } = null!; public EventOccurrence[] Occurrences { get; private set; } = [];
        public EventRegistrationParticipant OwnerPerson { get; private set; } = null!; public EventRegistrationParticipant OtherPerson { get; private set; } = null!;
        public EventActivityOperationsService Service { get; }
        public Fixture()
        { var approval = Substitute.For<IEventPackageService>(); approval.IsRegistrationApprovalCurrentAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(true); Service = new(Db, Substitute.For<IEventPackageInvalidationService>(), Substitute.For<IEventCacheInvalidationService>(), approval); }
        public async Task Setup()
        {
            var group = new Group { Id = Guid.NewGuid(), IsChurch = true, NameJson = "{}" }; Db.Groups.Add(group);
            foreach (var member in new[] { Owner, Other, Finance, Approver }) { Db.Members.Add(new() { Id = member, DisplayName = member.ToString() }); Db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = group.Id, MemberId = member, Status = MembershipStatus.Approved }); }
            Event = new() { Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = Owner, AccountableOwnerMemberId = Owner, StartDate = DateTime.UtcNow.AddDays(2), EndDate = DateTime.UtcNow.AddDays(4), EventDataJson = "{\"registrationMode\":\"required\",\"timeZone\":\"Australia/Perth\"}", ActivePlanVersion = 1, PublicationStatus = EventPublicationStatus.Published, RegistrationStatus = EventRegistrationStatus.Open }; Db.GroupEvents.Add(Event);
            Occurrences = [new() { Id = Guid.NewGuid(), EventId = Event.Id, StartUtc = Event.StartDate, EndUtc = Event.StartDate.AddHours(4) }, new() { Id = Guid.NewGuid(), EventId = Event.Id, StartUtc = Event.StartDate.AddDays(1), EndUtc = Event.StartDate.AddDays(1).AddHours(4) }]; Db.EventOccurrences.AddRange(Occurrences);
            var choices = new[] { new ModuleSelectionInput("PEOPLE.REGISTRATION", true), new("MONEY.FINANCE", true), new("PLACE.RESOURCE", true), new("SAFEGUARDING.CHILD", true) };
            var plan = new EventCompositionEngine().Compose(
                EventCompositionTestData.CurrentRequest(selections: choices),
                new EventCompositionContext("\"initial\"", HasAccountableOwner: true)).Value!;
            Db.EventPlanSnapshots.Add(new() { Id = Guid.NewGuid(), EventId = Event.Id, Version = 1, SourceFactSetId = Guid.NewGuid(), SchemaVersion = plan.SchemaVersion, ProposalHash = plan.ProposalHash, SnapshotJson = EventCompositionPersistence.SerializePlan(plan, []), ETag = EventCompositionPersistence.CreatePlanETag(1, plan.ProposalHash), IsActive = true, AcceptedByMemberId = Owner });
            Db.EventActivityPlans.Add(EventActivityPlanPersistence.New(Event.Id, new ActivityPlanData([new("a", [], new("Meal", "聚餐"), new("", "")) { Answers = ProjectAnswers() }, new("b", ["hiking"], new("Walk", "徒步"), new("", "")) { Answers = ProjectAnswers() }], QuestionnaireVersion: 2), DateTime.UtcNow));
            var text = new LocalizedTextDto("Terms", "条款"); Db.EventRegistrationPolicies.Add(new() { EventId = Event.Id, Version = 1, RulesJson = RamEvaluator.Serialize(new RegistrationRules(text, "public", null, text, 0, DateTime.UtcNow.AddDays(-1), Event.EndDate, true, "app", text, text, text, false, [])) });
            OwnerPerson = Person(Owner); OtherPerson = Person(Other); Role(Finance, "MONEY.FINANCE:finance.owner"); Role(Approver, "MONEY.FINANCE:finance.approver"); await Db.SaveChangesAsync();
        }
        private EventRegistrationParticipant Person(Guid member)
        { var app = new EventRegistrationApplication { Id = Guid.NewGuid(), EventId = Event.Id, OrganiserMemberId = member, CreatedByMemberId = Owner }; var p = new EventRegistrationParticipant { Id = Guid.NewGuid(), MemberId = member, DisplayName = member.ToString(), Application = app, ApplicationId = app.Id, SeatStatus = "confirmed" }; app.Participants.Add(p); Db.EventRegistrationApplications.Add(app); return p; }
        public EventRegistrationParticipant Child(bool confirmed)
        { var app = new EventRegistrationApplication { Id = Guid.NewGuid(), EventId = Event.Id, OrganiserMemberId = Owner, CreatedByMemberId = Owner }; var p = new EventRegistrationParticipant { Id = Guid.NewGuid(), IsChild = true, GuardianMemberId = Other, DisplayName = "Guest child", Application = app, ApplicationId = app.Id, SeatStatus = "confirmed" }; app.Participants.Add(p); Db.EventRegistrationApplications.Add(app); if (confirmed) ConfirmGuardian(p); return p; }
        public void ConfirmGuardian(EventRegistrationParticipant child)
        {
            var c = new EventChildRegistration { Id = Guid.NewGuid(), EventId = Event.Id, RegistrationParticipantId = child.Id, CreatedByMemberId = Owner }; Db.EventChildRegistrations.Add(c);
            var relationship = new EventChildGuardianRelationship { Id = Guid.NewGuid(), ChildRegistrationId = c.Id, GuardianMemberId = Other, CreatedByMemberId = Owner, Status = EventGuardianRelationshipStatus.Confirmed }; Db.EventChildGuardianRelationships.Add(relationship);
            var config = Db.EventSafeguardingConfigurations.Local.FirstOrDefault(x => x.EventId == Event.Id);
            if (config is null)
            {
                var policy = new EventSafeguardingPolicyVersion { Id = Guid.NewGuid(), GroupId = Event.GroupId, Version = 1, IsPublished = true, CreatedByMemberId = Owner }; Db.EventSafeguardingPolicyVersions.Add(policy);
                config = new() { Id = Guid.NewGuid(), EventId = Event.Id, PolicyVersionId = policy.Id, ConfiguredByMemberId = Owner }; Db.EventSafeguardingConfigurations.Add(config);
            }
            Db.EventChildConsentRecords.Add(new() { Id = Guid.NewGuid(), ChildRegistrationId = c.Id, GuardianRelationshipId = relationship.Id, PolicyVersionId = config.PolicyVersionId, Decision = EventGuardianConsentDecision.Granted, RecordedByMemberId = Other, RecordedUtc = DateTime.UtcNow });
        }
        public async Task ChangeActivity(string id, Func<PlannedActivity, PlannedActivity> change)
        { var source = await EventActivityPlanPersistence.LoadAsync(Db, Event.Id, true, default); var data = EventActivityPlanPersistence.ToData(source!); EventActivityPlanPersistence.Replace(Db, source!, data with { Activities = data.Activities.Select(a => a.Id == id ? change(a) : a).ToArray() }, DateTime.UtcNow); await Db.SaveChangesAsync(); }
        public IReadOnlyDictionary<string, PlannedActivityAnswer> ProjectAnswers(PlannedActivityAnswer? minors = null) =>
            EventProjectQuestionCatalog.ProjectSwitchCodes.ToDictionary(
                code => code,
                code => code == "minorsParticipate" && minors is not null
                    ? minors
                    : new PlannedActivityAnswer("yes", "human", true),
                StringComparer.Ordinal);
        private void Role(Guid member, string role) => Db.EventRoleAssignments.Add(new() { Id = Guid.NewGuid(), EventId = Event.Id, MemberId = member, RoleRequirementKey = role, AssignedByMemberId = Owner, Status = EventRoleAssignmentStatus.Accepted });
        public ActivityProjectRules Rules(int capacity = 5, long fee = 0, string scope = "perOccurrence") => new(new("", ""), null, null, capacity, true, false, fee, "NZD", DateTime.UtcNow.AddDays(-1), Event.StartDate.AddHours(-1), false, new("Terms", "条款"), scope);
        public async Task Policy(string activity, ActivityProjectRules rules)
        { var result = await Service.SavePolicyAsync(Event.Id, activity, Owner, rules, EventActivityOperationsService.NewETag, default); Assert.True(result.IsSuccess, result.Message); var p = await Db.EventActivityPolicyVersions.SingleAsync(p => p.ActivityId == activity && p.IsCurrent); if (rules.FeeMinor > 0) { p.FeeApprovalStatus = "approved"; p.FeeSubmittedByMemberId = Finance; p.FeeApprovedByMemberId = Approver; await Db.SaveChangesAsync(); } }
        public async Task<EventActivityOffer> Offer(string activity, EventOccurrence occurrence)
        { var result = await Service.SaveOfferAsync(Event.Id, activity, Owner, new(occurrence.Id, occurrence.StartUtc, occurrence.EndUtc), EventActivityOperationsService.NewETag, default); Assert.True(result.IsSuccess, result.Message); return await Db.EventActivityOffers.SingleAsync(o => o.ActivityId == activity && o.OccurrenceId == occurrence.Id); }
        public async Task<EventActivityOffer> Open(string activity, int capacity, long fee = 0, string scope = "perOccurrence") { await Policy(activity, Rules(capacity, fee, scope)); var offer = await Offer(activity, Occurrences[0]); await OpenOffer(offer); return offer; }
        public async Task OpenOffer(EventActivityOffer offer) { var result = await Service.OfferActionAsync(Event.Id, offer.Id, Owner, "open", EventActivityOperationsService.ETag(offer.ConcurrencyToken), Guid.NewGuid().ToString(), new(), default); Assert.True(result.IsSuccess, result.Message); }
        public async Task<EventActivityParticipation> Select(EventRegistrationParticipant person, Guid offer)
        { var change = new ActivitySelectionRequest(person.Id, [offer], []); var preview = await Service.PreviewSelectionAsync(Event.Id, Owner, change, default); Assert.True(preview.IsSuccess, preview.Message); var result = await Service.ApplySelectionAsync(Event.Id, Owner, new(change, preview.Value!.PreviewToken), Guid.NewGuid().ToString(), default); Assert.True(result.IsSuccess, result.Message); return await Db.EventActivityParticipations.SingleAsync(p => p.ParticipantId == person.Id && p.OfferId == offer && p.SeatStatus != "cancelled"); }
        public async Task Act(EventActivityParticipation row, Guid actor, string operation, ActivityParticipationActionRequest? request = null)
        { var result = await Service.ParticipationActionAsync(Event.Id, row.Id, actor, operation, request ?? new(), EventActivityOperationsService.ETag(row.ConcurrencyToken), Guid.NewGuid().ToString(), default); Assert.True(result.IsSuccess, result.Message); }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }
}
