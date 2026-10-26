using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    [Theory]
    [InlineData(EventPackageEnforcementMode.DryRun)]
    [InlineData(EventPackageEnforcementMode.Off)]
    public async Task ExecutionConfirmation_RejectsHistoricalChildCompletionWithoutCurrentConsent(EventPackageEnforcementMode mode)
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var policy = await db.EventPackageGovernancePolicyVersions.SingleAsync(); policy.EnforcementMode = mode;
        seeded.Event.StartDate = DateTime.UtcNow.AddHours(24); seeded.Event.EndDate = DateTime.UtcNow.AddHours(27);
        var package = new EventPackage
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, Version = 1, EventPlanVersion = 1,
            GovernancePolicyVersionId = policy.Id, GovernancePolicyVersion = "2026.1", GovernanceTier = EventGovernanceTier.Light,
            Status = EventPackageStatus.Approved, ApprovalValidityStatus = EventPackageApprovalValidity.Active,
            ContentHash = new string('a', 64), SourceVectorHash = new string('b', 64), GeneratedByMemberId = seeded.Owner, GeneratedUtc = DateTime.UtcNow
        };
        db.EventPackages.Add(package);
        var application = new EventRegistrationApplication { Id = Guid.NewGuid(), EventId = seeded.Event.Id, OrganiserMemberId = seeded.Owner, CreatedByMemberId = seeded.Owner };
        var child = new EventRegistrationParticipant { Id = Guid.NewGuid(), ApplicationId = application.Id, Application = application, IsChild = true, DisplayName = "Private child", SeatStatus = "confirmed" };
        application.Participants.Add(child); db.EventRegistrationApplications.Add(application);
        var projectPolicy = new EventActivityPolicyVersion { Id = Guid.NewGuid(), EventId = seeded.Event.Id, ActivityId = "restricted", Version = 1, IsCurrent = true, RulesJson = "{}", CreatedByMemberId = seeded.Owner };
        db.EventActivityPolicyVersions.Add(projectPolicy);
        var offer = new EventActivityOffer { Id = Guid.NewGuid(), EventId = seeded.Event.Id, ActivityId = "restricted", OccurrenceId = seeded.Occurrences[0].Id, PolicyVersionId = projectPolicy.Id, StartUtc = seeded.Event.StartDate, EndUtc = seeded.Event.EndDate, Status = "open" };
        db.EventActivityOffers.Add(offer);
        var participation = new EventActivityParticipation { Id = Guid.NewGuid(), OfferId = offer.Id, ParticipantId = child.Id, PolicyVersionId = projectPolicy.Id, FeePolicyVersionId = projectPolicy.Id, SeatStatus = "confirmed", ProcedureStatus = "complete" };
        db.EventActivityParticipations.Add(participation);
        db.EventActivityConsents.Add(new() { Id = Guid.NewGuid(), ParticipationId = participation.Id, PolicyVersionId = projectPolicy.Id, ActorMemberId = seeded.Owner, Method = "guardianOnline", Evidence = "Historical text without current scope", ConsentedUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization()); var lifecycle = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);
        Assert.Contains(EventActivityOperationsService.ChildProjectExecutionBlocked, lifecycle.Value!.ExecutionReasonCodes);
        Assert.False(lifecycle.Value.Gates.Single(g => g.Gate == EventLifecycleGate.Execute).Allowed);
        var result = await service.ConfirmExecutionAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Event, null, package.Id, $"\"package-1-{package.ConcurrencyToken:N}\"", lifecycle.Value.ExecutionETag), "invalid-child-scope", default);
        Assert.Equal(AppResultStatus.Conflict, result.Status); Assert.Equal(EventActivityOperationsService.ChildProjectExecutionBlocked, result.Message);
        Assert.NotEqual(EventExecutionStatus.Confirmed, seeded.Event.ExecutionStatus); Assert.DoesNotContain("Private child", result.Message);
    }
}
