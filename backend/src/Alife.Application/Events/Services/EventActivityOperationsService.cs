using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventActivityOperationsService(IAlifeDbContext db, IEventPackageInvalidationService invalidation,
    IEventCacheInvalidationService cache, IEventPackageService? packages = null)
{
    public static string ETag(Guid token) => $"\"activity-{token:N}\"";
    public const string NewETag = "\"activity-new\"";
    public static ActivityProjectRules Rules(EventActivityPolicyVersion policy) => JsonSerializer.Deserialize<ActivityProjectRules>(policy.RulesJson, RamEvaluator.Json)!;
    private Task<bool> Manager(GroupEvent e, Guid actor, CancellationToken ct) => Allowed(e, actor, "PEOPLE.REGISTRATION", "registration.manager", ct);
    private async Task<bool> Allowed(GroupEvent e, Guid actor, string module, string role, CancellationToken ct) =>
        await EventWorkAccess.OwnerAsync(db, e, actor, ct) || await EventWorkAccess.RoleAsync(db, e, actor, module, role, ct);
    private Task<bool> Finance(GroupEvent e, Guid actor, CancellationToken ct) => EventWorkAccess.RoleAsync(db, e, actor, "MONEY.FINANCE", "finance.owner", ct);
    private Task<bool> FeeApprover(GroupEvent e, Guid actor, CancellationToken ct) => EventWorkAccess.RoleAsync(db, e, actor, "MONEY.FINANCE", "finance.approver", ct);
    private static bool Own(EventRegistrationParticipant p, Guid actor, bool proxy = true) =>
        p.MemberId == actor || proxy && !p.IsChild && !p.ProxyAccessRevoked && p.Application.OrganiserMemberId == actor;
    private Task<bool> Guardian(EventRegistrationParticipant person, Guid actor, CancellationToken ct) => person.IsChild && person.SeatStatus is not ("cancelled" or "expired")
        ? db.EventChildGuardianRelationships.AnyAsync(g => g.ChildRegistration.EventId == person.Application.EventId && g.ChildRegistration.IsActive && g.ChildRegistration.RegistrationParticipantId == person.Id && g.GuardianMemberId == actor && g.Status == EventGuardianRelationshipStatus.Confirmed, ct)
        : Task.FromResult(false);
    private async Task<bool> ParticipantActor(EventRegistrationParticipant person, Guid actor, CancellationToken ct, bool proxy = true) => Own(person, actor, proxy) || await Guardian(person, actor, ct);
    private async Task<bool> Readable(GroupEvent e, Guid actor, CancellationToken ct)
    {
        if (await EventWorkAccess.PlanReaderAsync(db, e, actor, ct) || await Finance(e, actor, ct) || await FeeApprover(e, actor, ct)) return true;
        if (await db.EventRegistrationParticipants.AnyAsync(p => p.Application.EventId == e.Id &&
            (p.MemberId == actor || p.IsChild && db.EventChildGuardianRelationships.Any(g => g.ChildRegistration.RegistrationParticipantId == p.Id && g.ChildRegistration.EventId == e.Id && g.ChildRegistration.IsActive && g.GuardianMemberId == actor && g.Status == EventGuardianRelationshipStatus.Confirmed) || !p.IsChild && !p.ProxyAccessRevoked && p.Application.OrganiserMemberId == actor && (!p.Application.IsInvitation || p.Application.InvitedUtc != null)), ct)) return true;
        if (e.PublicationStatus != EventPublicationStatus.Published) return false;
        var visibility = EventVisibilityPolicy.ReadVisibility(e.EventDataJson);
        if (visibility == "public" || await EventWorkAccess.MemberAsync(db, e.GroupId, actor, ct)) return true;
        var root = await EventCompositionPersistence.FindChurchRootIdAsync(db, e.GroupId, ct);
        return visibility == "churchVisible" && root.HasValue && await EventWorkAccess.MemberAsync(db, root.Value, actor, ct);
    }
    private Task<bool> Approved(GroupEvent e, CancellationToken ct) => packages?.IsRegistrationApprovalCurrentAsync(e.Id, ct) ?? Task.FromResult(false);
    private async Task<bool> EventFirstEnabled(GroupEvent e, CancellationToken ct)
    {
        using var data = JsonDocument.Parse(e.EventDataJson);
        return data.RootElement.TryGetProperty("registrationMode", out var value) && value.ValueKind == JsonValueKind.String && value.GetString() == "required" &&
            await db.EventRegistrationPolicies.AnyAsync(p => p.EventId == e.Id, ct) && await EventWorkAccess.EnabledAsync(db, e.Id, "PEOPLE.REGISTRATION", ct);
    }
    private async Task<bool> ValidActivity(Guid eventId, string activityId, Guid? occurrenceId, CancellationToken ct)
    {
        var source = await EventActivityPlanService.ReadAsync(db, eventId, ct);
        return source?.Data.Activities.Any(a => a.Id == activityId && (!occurrenceId.HasValue || !a.OccurrenceId.HasValue || a.OccurrenceId == occurrenceId)) == true;
    }

    public async Task<AppResult<ActivityOperationsWorkspaceDto>> GetAsync(Guid eventId, Guid actor, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Event not found.");
        if (!await Readable(e, actor, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("Current Event access is required.");
        var manager = await Manager(e, actor, ct); var finance = await Finance(e, actor, ct); var approver = await FeeApprover(e, actor, ct);
        var draftReader = await EventWorkAccess.PlanReaderAsync(db, e, actor, ct) || finance || approver;
        var approved = await Approved(e, ct);
        var source = await EventActivityPlanService.ReadAsync(db, eventId, ct);
        var policies = await db.EventActivityPolicyVersions.AsNoTracking().Where(p => p.EventId == eventId && p.IsCurrent).ToArrayAsync(ct);
        var offers = await db.EventActivityOffers.AsNoTracking().Include(o => o.Policy).Where(o => o.EventId == eventId).ToArrayAsync(ct);
        var rows = await db.EventActivityParticipations.AsNoTracking().Include(p => p.Participant).ThenInclude(p => p.Application).Where(p => p.Offer.EventId == eventId).ToArrayAsync(ct);
        var paymentRows = await db.EventActivityPayments.AsNoTracking().Where(p => p.Participation.Offer.EventId == eventId).ToArrayAsync(ct);
        var spaces = await db.EventActivitySpaceRequests.AsNoTracking().Where(s => s.Offer.EventId == eventId).ToArrayAsync(ct);
        var people = await db.EventRegistrationParticipants.AsNoTracking().Include(p => p.Application).Where(p => p.Application.EventId == eventId).ToArrayAsync(ct);
        var guardianIds = await db.EventChildGuardianRelationships.AsNoTracking().Where(g => g.ChildRegistration.EventId == eventId && g.ChildRegistration.IsActive && g.GuardianMemberId == actor && g.Status == EventGuardianRelationshipStatus.Confirmed).Select(g => g.ChildRegistration.RegistrationParticipantId).ToArrayAsync(ct);
        bool Actor(EventRegistrationParticipant p) => Own(p, actor) || guardianIds.Contains(p.Id);
        var visiblePeople = people.Where(p => manager || finance || Actor(p) && (!p.Application.IsInvitation || p.Application.InvitedUtc != null)).ToArray();
        var visibleIds = visiblePeople.Select(p => p.Id).ToHashSet();
        var projects = (source?.Data.Activities ?? []).Select(activity =>
        {
            var policy = policies.FirstOrDefault(p => p.ActivityId == activity.Id);
            var availableOffers = offers.Where(o => o.ActivityId == activity.Id && (draftReader || approved && o.Status == "open" || rows.Any(p => p.OfferId == o.Id && visibleIds.Contains(p.ParticipantId)))).OrderBy(o => o.StartUtc).ToArray();
            var projectOffers = availableOffers.Select(o => OfferDto(o, rows, draftReader ? spaces : approved && o.Status == "open" ? spaces.Where(s => s.Status == "confirmed") : [])).ToArray();
            if (!draftReader && !availableOffers.Any(o => approved && o.Status == "open")) policy = null;
            var projectRows = rows.Where(p => offers.Any(o => o.Id == p.OfferId && o.ActivityId == activity.Id) && visibleIds.Contains(p.ParticipantId)).Select(p =>
                new ActivityParticipationDto(p.Id, p.OfferId, p.ParticipantId, p.Participant.DisplayName, p.SeatStatus, manager || Actor(p.Participant) ? p.ProcedureStatus : "", manager || Actor(p.Participant) ? p.Eligibility : "", p.FeeMinor, p.Currency,
                    paymentRows.Where(x => x.ParticipationId == (p.ChargeParticipationId ?? p.Id) && x.Operation == "payment").Sum(x => x.AmountMinor), paymentRows.Where(x => x.ParticipationId == (p.ChargeParticipationId ?? p.Id) && x.Operation == "refund").Sum(x => x.AmountMinor), p.ReservedUntilUtc, ETag(p.ConcurrencyToken), p.ChargeParticipationId ?? p.Id)).ToArray();
            return new ActivityProjectDto(activity.Id, new(activity.Name.En, activity.Name.Zh), policy is null ? null : PolicyDto(policy), projectOffers, projectRows);
        }).Where(p => draftReader || p.Offers.Count > 0 || p.Participations.Count > 0).ToArray();
        return AppResult<ActivityOperationsWorkspaceDto>.Success(new(eventId, manager, finance, approver,
            await Allowed(e, actor, "PLACE.RESOURCE", "resource.coordinator", ct) && await EventWorkAccess.EnabledAsync(db, eventId, "PLACE.RESOURCE", ct), projects,
            visiblePeople.Select(p => new ActivityParticipantOptionDto(p.Id, p.DisplayName, (manager || Actor(p)) && p.IsChild, p.SeatStatus,
                p.MemberId == actor || guardianIds.Contains(p.Id), p.IsChild && guardianIds.Contains(p.Id), manager || Actor(p))).ToArray(), await EventWorkAccess.OwnerAsync(db, e, actor, ct)));
    }
    private static ActivityProjectPolicyDto PolicyDto(EventActivityPolicyVersion p) => new(p.Id, p.Version, Rules(p), ETag(p.ConcurrencyToken), p.FeeApprovalStatus);
    private static ActivityOfferDto OfferDto(EventActivityOffer o, IEnumerable<EventActivityParticipation> rows, IEnumerable<EventActivitySpaceRequest> spaces)
    {
        var current = rows.Where(p => p.OfferId == o.Id).ToArray(); var space = spaces.FirstOrDefault(s => s.OfferId == o.Id);
        return new(o.Id, o.ActivityId, o.OccurrenceId, o.StartUtc, o.EndUtc, Rules(o.Policy).Capacity, o.Status, ETag(o.ConcurrencyToken),
            current.Count(p => p.SeatStatus == "confirmed"), current.Count(p => p.SeatStatus == "reserved" && p.ReservedUntilUtc > DateTime.UtcNow), current.Count(p => p.SeatStatus == "waitlisted"),
            space is null ? null : new(space.Id, space.Kind, space.ReservationId, new(space.NameEn, space.NameZh), space.Status, ETag(space.ConcurrencyToken)));
    }

    public async Task<AppResult<ActivityOperationsWorkspaceDto>> SavePolicyAsync(Guid eventId, string activityId, Guid actor, ActivityProjectRules rules, string expected, CancellationToken ct)
    {
        if (!ValidRules(rules)) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Use complete bilingual terms, valid UTC dates, capacity, age limits and minor-unit fees.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Event not found.");
        if (!await EventWorkAccess.OwnerAsync(db, e, actor, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("Only the current owner configures activity policies.");
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        var source = await EventActivityPlanService.ReadAsync(db, eventId, ct);
        var activity = source?.Data.Activities.FirstOrDefault(item => item.Id == activityId);
        if (activity is null) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Activity is not in this Event plan.");
        if (source!.Data.QuestionnaireVersion == 2)
        {
            bool On(string code) => activity.Answers?.TryGetValue(code, out var answer) == true && answer is { Value: "yes", Confirmed: true };
            if ((rules.MinimumAge.HasValue || rules.MaximumAge.HasValue) && !On("ageEligibility") ||
                rules.Capacity > 0 && !On("capacityLimit") || rules.FeeMinor > 0 && !On("projectFee") ||
                rules.NeedsSpace && !On("spaceReservation"))
                return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Enable the matching project arrangement switches before saving these age, capacity, fee or space rules. / 保存年龄、名额、费用或场地规则前，请勾选对应项目安排。");
        }
        var old = await db.EventActivityPolicyVersions.FirstOrDefaultAsync(p => p.EventId == eventId && p.ActivityId == activityId && p.IsCurrent, ct);
        if (expected != (old is null ? NewETag : ETag(old.ConcurrencyToken))) return AppResult<ActivityOperationsWorkspaceDto>.PreconditionFailed("Activity policy changed.");
        var basePolicy = await db.EventRegistrationPolicies.AsNoTracking().FirstOrDefaultAsync(p => p.EventId == eventId, ct);
        if (basePolicy is not null && EventRegistrationWorkService.Rules(basePolicy).Currency != rules.Currency) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Project fees must use the Event registration currency.");
        var offers = await db.EventActivityOffers.Where(o => o.EventId == eventId && o.ActivityId == activityId).ToArrayAsync(ct);
        var rows = await db.EventActivityParticipations.Where(p => p.Offer.EventId == eventId && p.Offer.ActivityId == activityId).ToArrayAsync(ct);
        if (offers.Any(o => rows.Count(p => p.OfferId == o.Id && (p.SeatStatus == "confirmed" || p.SeatStatus == "reserved" && p.ReservedUntilUtc > DateTime.UtcNow)) > EffectiveCapacity(rules)))
            return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Capacity cannot be below confirmed and reserved participants.");
        var json = RamEvaluator.Serialize(rules);
        if (old?.RulesJson == json) return await GetAsync(eventId, actor, ct);
        if (old is not null) { old.IsCurrent = false; old.ConcurrencyToken = Guid.NewGuid(); }
        var version = new EventActivityPolicyVersion { Id = Guid.NewGuid(), EventId = eventId, ActivityId = activityId, Version = (old?.Version ?? 0) + 1, RulesJson = json,
            FeeApprovalStatus = rules.FeeMinor > 0 ? "notSubmitted" : "notRequired", CreatedByMemberId = actor, CreatedUtc = DateTime.UtcNow };
        db.EventActivityPolicyVersions.Add(version);
        foreach (var offer in offers) { offer.PolicyVersionId = version.Id; offer.Policy = version; offer.ConcurrencyToken = Guid.NewGuid(); offer.Status = "draft"; }
        foreach (var row in rows.Where(p => p.SeatStatus is not ("cancelled" or "expired"))) { row.PolicyVersionId = version.Id; row.ProcedureStatus = "reconfirmationRequired"; row.Eligibility = "needsReview"; row.EligibilityVerified = false; row.ConcurrencyToken = Guid.NewGuid(); }
        await NotifyChanged(e, actor, rows.Where(p => p.SeatStatus is not ("cancelled" or "expired")).Select(p => p.ParticipantId), "event.activity.policyChanged", ct);
        await invalidation.InvalidateForModuleChangeAsync(e, actor, "PEOPLE.REGISTRATION", "event.activity.policyChanged", "governanceCritical", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); await cache.RemoveGroupEventsAsync(e.GroupId, ct);
        return await GetAsync(eventId, actor, ct);
    }
    private static int EffectiveCapacity(ActivityProjectRules rules) => rules.Capacity == 0 ? int.MaxValue : rules.Capacity;
    private static bool ValidRules(ActivityProjectRules? r) => r is not null && r.Capacity is >= 0 and <= 1000000 && r.MinimumAge is null or >= 0 and <= 130 && r.MaximumAge is null or >= 0 and <= 130 &&
        (r.MinimumAge is null || r.MaximumAge is null || r.MinimumAge <= r.MaximumAge) && r.FeeMinor is >= 0 and <= 100000000 && r.Currency is { Length: 3 } && r.Currency.All(char.IsAsciiLetterUpper) &&
        r.FeeChargeScope is "perOccurrence" or "oncePerSeries" && r.OpensUtc.Kind == DateTimeKind.Utc && r.DeadlineUtc.Kind == DateTimeKind.Utc && r.OpensUtc < r.DeadlineUtc && Text(r.Eligibility, false) && Text(r.Terms, true);
    private static bool Text(LocalizedTextDto? t, bool required) => t is not null && t.En is not null && t.Zh is not null && t.En.Length <= 4000 && t.Zh.Length <= 4000 && (!required || !string.IsNullOrWhiteSpace(t.En) && !string.IsNullOrWhiteSpace(t.Zh));

    public async Task<AppResult<ActivityOperationsWorkspaceDto>> SaveOfferAsync(Guid eventId, string activityId, Guid actor, SaveActivityOfferRequest request, string expected, CancellationToken ct)
    {
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Event not found.");
        if (!await EventWorkAccess.OwnerAsync(db, e, actor, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("Only the current owner configures activity occurrences.");
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        var occurrence = await db.EventOccurrences.FirstOrDefaultAsync(o => o.Id == request.OccurrenceId && o.EventId == eventId && o.Status != EventOccurrenceStatus.Cancelled, ct);
        if (occurrence is null || !await ValidActivity(eventId, activityId, occurrence.Id, ct) || request.StartUtc.Kind != DateTimeKind.Utc || request.EndUtc.Kind != DateTimeKind.Utc || request.StartUtc >= request.EndUtc || request.StartUtc < DateTime.SpecifyKind(occurrence.StartUtc, DateTimeKind.Utc) || request.EndUtc > DateTime.SpecifyKind(occurrence.EndUtc, DateTimeKind.Utc))
            return AppResult<ActivityOperationsWorkspaceDto>.Validation("Choose a valid activity and UTC interval within this Event occurrence.");
        var policy = await db.EventActivityPolicyVersions.FirstOrDefaultAsync(p => p.EventId == eventId && p.ActivityId == activityId && p.IsCurrent, ct);
        if (policy is null) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Save project policy first.");
        var offer = await db.EventActivityOffers.FirstOrDefaultAsync(o => o.EventId == eventId && o.ActivityId == activityId && o.OccurrenceId == occurrence.Id, ct);
        if (expected != (offer is null ? NewETag : ETag(offer.ConcurrencyToken))) return AppResult<ActivityOperationsWorkspaceDto>.PreconditionFailed("Project occurrence changed.");
        if (offer is null) { offer = new() { Id = Guid.NewGuid(), EventId = eventId, ActivityId = activityId, OccurrenceId = occurrence.Id }; db.EventActivityOffers.Add(offer); }
        else
        {
            var affected = await db.EventActivityParticipations.Where(p => p.OfferId == offer.Id && p.SeatStatus != "cancelled" && p.SeatStatus != "expired").ToArrayAsync(ct);
            foreach (var row in affected) { row.ProcedureStatus = "reconfirmationRequired"; row.ConcurrencyToken = Guid.NewGuid(); }
            await NotifyChanged(e, actor, affected.Select(p => p.ParticipantId), "event.activity.occurrenceChanged", ct);
        }
        offer.StartUtc = request.StartUtc; offer.EndUtc = request.EndUtc; offer.PolicyVersionId = policy.Id; offer.Status = "draft"; offer.ConcurrencyToken = Guid.NewGuid(); offer.UpdatedUtc = DateTime.UtcNow;
        await invalidation.InvalidateForOccurrenceModuleChangeAsync(e, occurrence.Id, actor, "PEOPLE.REGISTRATION", "event.activity.occurrenceChanged", "governanceCritical", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); await cache.RemoveGroupEventsAsync(e.GroupId, ct);
        return await GetAsync(eventId, actor, ct);
    }
}
