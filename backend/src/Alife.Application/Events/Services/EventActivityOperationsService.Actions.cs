using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventActivityOperationsService
{
    private static string Hash(object value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(RamEvaluator.Serialize(value))));
    private async Task<string?> Replay(Guid eventId, Guid actor, string operation, object request, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 160) return "A valid Idempotency-Key is required.";
        var previous = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.ScopeId == eventId && x.Operation == "activity." + operation && x.Key == key, ct);
        return previous is null ? null : previous.RequestHash == Hash(new { eventId, actor, request }) ? "replay" : "Idempotency-Key conflicts with another activity request.";
    }
    private void Remember(Guid eventId, Guid actor, string operation, object request, string key, Guid result) => db.EventIdempotencyRecords.Add(new()
    { Id = Guid.NewGuid(), ScopeId = eventId, Operation = "activity." + operation, Key = key, RequestHash = Hash(new { eventId, actor, request }), ResultEntityId = result, CreatedUtc = DateTime.UtcNow, ExpiresUtc = DateTime.UtcNow.AddDays(7) });
    private void Audit(Guid eventId, Guid actor, string operation, Guid? participant = null, string? evidence = null) => db.EventRegistrationActions.Add(new()
    { Id = Guid.NewGuid(), EventId = eventId, ParticipantId = participant, ActorMemberId = actor, Operation = "activity." + operation, Evidence = evidence ?? "", SnapshotJson = "{}", CreatedUtc = DateTime.UtcNow });
    private async Task<bool> ValidFeeApproval(GroupEvent e, EventActivityPolicyVersion policy, CancellationToken ct) => Rules(policy).FeeMinor == 0 ||
        policy.FeeApprovalStatus == "approved" && policy.FeeSubmittedByMemberId is { } owner && policy.FeeApprovedByMemberId is { } reviewer && owner != reviewer &&
        await EventWorkAccess.EnabledAsync(db, e.Id, "MONEY.FINANCE", ct) && await Finance(e, owner, ct) && await FeeApprover(e, reviewer, ct) && !await Finance(e, reviewer, ct);

    public async Task<AppResult<ActivityOperationsWorkspaceDto>> FeeActionAsync(Guid eventId, string activityId, Guid actor, string operation, string expected, string? key, ActivityParticipationActionRequest request, CancellationToken ct)
    {
        if (operation is not ("submit" or "approve" or "return") || (request.Evidence?.Length ?? 0) > 2000) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Invalid fee action.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Event not found.");
        if (!await EventWorkAccess.EnabledAsync(db, eventId, "MONEY.FINANCE", ct) || (operation == "submit" ? !await Finance(e, actor, ct) : !await FeeApprover(e, actor, ct)))
            return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("The designated finance role is required.");
        var policy = await db.EventActivityPolicyVersions.FirstOrDefaultAsync(p => p.EventId == eventId && p.ActivityId == activityId && p.IsCurrent, ct);
        if (policy is null || Rules(policy).FeeMinor == 0) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("No current project fee is configured.");
        var input = new { activityId, operation, request, policy.Id }; var replay = await Replay(eventId, actor, "fees." + operation, input, key, ct);
        if (replay is not null) return replay == "replay" ? await GetAsync(eventId, actor, ct) : AppResult<ActivityOperationsWorkspaceDto>.Conflict(replay);
        if (expected != ETag(policy.ConcurrencyToken)) return AppResult<ActivityOperationsWorkspaceDto>.PreconditionFailed("Project fee changed.");
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        if (operation == "submit")
        { policy.FeeApprovalStatus = "pending"; policy.FeeSubmittedByMemberId = actor; policy.FeeApprovedByMemberId = null; }
        else
        {
            if (policy.FeeApprovalStatus != "pending" || policy.FeeSubmittedByMemberId == actor || await Finance(e, actor, ct) || policy.FeeSubmittedByMemberId is not { } owner || !await Finance(e, owner, ct))
                return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("Current independent finance approval is required.");
            if (operation == "return" && string.IsNullOrWhiteSpace(request.Evidence)) return AppResult<ActivityOperationsWorkspaceDto>.Validation("A return reason is required.");
            policy.FeeApprovalStatus = operation == "approve" ? "approved" : "returned"; policy.FeeApprovedByMemberId = operation == "approve" ? actor : null;
        }
        policy.ConcurrencyToken = Guid.NewGuid(); Remember(eventId, actor, "fees." + operation, input, key!, policy.Id); Audit(eventId, actor, "fee." + operation, evidence: request.Evidence);
        await invalidation.InvalidateForModuleChangeAsync(e, actor, "MONEY.FINANCE", "event.activity.feeApproval", "operational", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); await cache.RemoveGroupEventsAsync(e.GroupId, ct);
        return await GetAsync(eventId, actor, ct);
    }

    public async Task<AppResult<ActivityOperationsWorkspaceDto>> OfferActionAsync(Guid eventId, Guid offerId, Guid actor, string operation, string expected, string? key, ActivityParticipationActionRequest request, CancellationToken ct)
    {
        if (operation is not ("open" or "close" or "cancel") || (request.Evidence?.Length ?? 0) > 2000) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Unknown project occurrence action.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Event not found.");
        if (!await Manager(e, actor, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("Current registration responsibility is required.");
        var offer = await db.EventActivityOffers.Include(o => o.Policy).FirstOrDefaultAsync(o => o.Id == offerId && o.EventId == eventId, ct);
        if (offer is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Project occurrence not found.");
        var input = new { offerId, operation, request }; var replay = await Replay(eventId, actor, "offer." + operation, input, key, ct);
        if (replay is not null) return replay == "replay" ? await GetAsync(eventId, actor, ct) : AppResult<ActivityOperationsWorkspaceDto>.Conflict(replay);
        if (expected != ETag(offer.ConcurrencyToken)) return AppResult<ActivityOperationsWorkspaceDto>.PreconditionFailed("Project occurrence changed.");
        if (offer.Status == "cancelled") return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Cancelled project occurrences cannot reopen.");
        if (operation == "open" && (offer.EndUtc <= DateTime.UtcNow || Rules(offer.Policy).DeadlineUtc <= DateTime.UtcNow || !await db.EventOccurrences.AnyAsync(o => o.Id == offer.OccurrenceId && o.Status != EventOccurrenceStatus.Cancelled, ct))) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("This project occurrence has ended or been cancelled.");
        if (operation == "open" && (!await EventFirstEnabled(e, ct) || !await ValidActivity(eventId, offer.ActivityId, offer.OccurrenceId, ct))) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Enable Event registration explicitly before opening project selection.");
        if (operation == "open")
        {
            var activityPlan = await EventActivityPlanService.ReadAsync(db, eventId, ct);
            var activity = activityPlan?.Data.Activities.FirstOrDefault(item => item.Id == offer.ActivityId);
            if (activityPlan?.Data.QuestionnaireVersion == 2 &&
                (activity?.Answers?.TryGetValue("projectSelection", out var selection) != true ||
                 selection is not { Value: "yes", Confirmed: true }))
                return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Enable this project's selection arrangement before opening its occurrence. / 开放场次前须开启此项目的选报安排。");
        }
        if (operation == "open" && !await CurrencyConsistent(eventId, [offer], ct)) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("All project fees must use the Event registration currency.");
        if (operation == "open" && (!await Approved(e, ct) || e.RegistrationStatus != EventRegistrationStatus.Open || !await ValidFeeApproval(e, offer.Policy, ct) || !await SpaceReady(offer, ct)))
            return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Current Event/fee approval, open Event registration and confirmed space are required.");
        if (operation == "cancel" && string.IsNullOrWhiteSpace(request.Evidence)) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Record the cancellation reason; paid project fees need manual refund review.");
        offer.Status = operation == "open" ? "open" : operation == "close" ? "closed" : "cancelled"; offer.ConcurrencyToken = Guid.NewGuid();
        if (operation == "cancel") foreach (var row in await db.EventActivityParticipations.Where(p => p.OfferId == offerId && p.SeatStatus != "cancelled").ToArrayAsync(ct)) { row.SeatStatus = "cancelled"; row.ReservedUntilUtc = null; row.ConcurrencyToken = Guid.NewGuid(); }
        if (operation == "cancel") await NotifyChanged(e, actor, await db.EventActivityParticipations.Where(p => p.OfferId == offerId).Select(p => p.ParticipantId).ToArrayAsync(ct), "event.activity.cancelled", ct);
        Remember(eventId, actor, "offer." + operation, input, key!, offer.Id); Audit(eventId, actor, "offer." + operation, evidence: request.Evidence);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); await cache.RemoveGroupEventsAsync(e.GroupId, ct); return await GetAsync(eventId, actor, ct);
    }

    private async Task<bool> SpaceReady(EventActivityOffer offer, CancellationToken ct)
    {
        if (!Rules(offer.Policy).NeedsSpace) return true;
        var space = await db.EventActivitySpaceRequests.AsNoTracking().FirstOrDefaultAsync(s => s.OfferId == offer.Id, ct);
        if (space?.Status != "confirmed") return false;
        if (space.Kind == "external") return !string.IsNullOrWhiteSpace(space.Evidence);
        if (Rules(offer.Policy).Capacity == 0) return false;
        var reservation = await db.EventVenueReservations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == space.ReservationId && r.EventId == offer.EventId && r.Venue.IsActive &&
            (r.EventOccurrenceId == null || r.EventOccurrenceId == offer.OccurrenceId) && r.Status == EventVenueReservationStatus.Confirmed &&
            r.StartUtc <= offer.StartUtc && r.EndUtc >= offer.EndUtc, ct);
        if (reservation is null) return false;
        var allocations = await db.EventActivitySpaceRequests.AsNoTracking().Include(s => s.Offer).ThenInclude(o => o.Policy).Where(s => s.ReservationId == reservation.Id && s.Status == "confirmed" && s.Offer.Status != "cancelled" && s.Offer.StartUtc < offer.EndUtc && offer.StartUtc < s.Offer.EndUtc).ToArrayAsync(ct);
        return allocations.Sum(s => Rules(s.Offer.Policy).Capacity) <= reservation.RequiredCapacity;
    }
    public async Task<AppResult<ActivityOperationsWorkspaceDto>> SaveSpaceAsync(Guid eventId, Guid offerId, Guid actor, SaveActivitySpaceRequest request, string expected, string? key, CancellationToken ct)
    {
        if (request.Kind is not ("internal" or "external") || request.Status is not ("draft" or "awaitingConfirmation" or "confirmed" or "refused" or "cancelled") || !Text(request.Name, true) || request.Name.En.Length > 300 || request.Name.Zh.Length > 300 || (request.Evidence?.Length ?? 0) > 2000)
            return AppResult<ActivityOperationsWorkspaceDto>.Validation("Choose valid space details and status.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Event not found.");
        if (!await Allowed(e, actor, "PLACE.RESOURCE", "resource.coordinator", ct) || !await EventWorkAccess.EnabledAsync(db, eventId, "PLACE.RESOURCE", ct)) return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("Current resource responsibility and enabled module are required.");
        var offer = await db.EventActivityOffers.Include(o => o.Policy).FirstOrDefaultAsync(o => o.Id == offerId && o.EventId == eventId, ct);
        if (offer is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Project occurrence not found.");
        var activityPlan = await EventActivityPlanService.ReadAsync(db, eventId, ct);
        var activity = activityPlan?.Data.Activities.FirstOrDefault(item => item.Id == offer.ActivityId);
        if (activityPlan?.Data.QuestionnaireVersion == 2 &&
            (activity?.Answers?.TryGetValue("spaceReservation", out var reservationAnswer) != true ||
             reservationAnswer is not { Value: "yes", Confirmed: true }))
            return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Enable this project's space arrangement before saving a room or external space request. / 保存房间或外部场地申请前须开启此项目的场地安排。");
        var input = new { offerId, request }; var replay = await Replay(eventId, actor, "space", input, key, ct);
        if (replay is not null) return replay == "replay" ? await GetAsync(eventId, actor, ct) : AppResult<ActivityOperationsWorkspaceDto>.Conflict(replay);
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        var row = await db.EventActivitySpaceRequests.FirstOrDefaultAsync(s => s.OfferId == offerId, ct);
        if (expected != (row is null ? NewETag : ETag(row.ConcurrencyToken))) return AppResult<ActivityOperationsWorkspaceDto>.PreconditionFailed("Space request changed.");
        if (request.Status == "confirmed" && request.Kind == "external" && string.IsNullOrWhiteSpace(request.Evidence)) return AppResult<ActivityOperationsWorkspaceDto>.Validation("External confirmation needs the human-verified approval evidence.");
        if (request.Kind == "internal")
        {
            if (request.Status == "confirmed" && Rules(offer.Policy).Capacity == 0)
                return AppResult<ActivityOperationsWorkspaceDto>.Validation("Set a finite project capacity before confirming an internal room allocation.");
            var reservation = await db.EventVenueReservations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == request.ReservationId && r.EventId == eventId, ct);
            if (reservation is null || reservation.Status != EventVenueReservationStatus.Confirmed || !await db.EventVenues.AnyAsync(v => v.Id == reservation.VenueId && v.IsActive, ct) || reservation.EventOccurrenceId.HasValue && reservation.EventOccurrenceId != offer.OccurrenceId || reservation.StartUtc > offer.StartUtc || reservation.EndUtc < offer.EndUtc || reservation.RequiredCapacity < Rules(offer.Policy).Capacity)
                return AppResult<ActivityOperationsWorkspaceDto>.Validation("Link a confirmed same-Event reservation covering the project time and capacity.");
            var shared = await db.EventActivitySpaceRequests.AsNoTracking().Include(s => s.Offer).ThenInclude(o => o.Policy).Where(s => s.ReservationId == reservation.Id && s.OfferId != offer.Id && s.Status == "confirmed" && s.Offer.Status != "cancelled" && s.Offer.StartUtc < offer.EndUtc && offer.StartUtc < s.Offer.EndUtc).ToArrayAsync(ct);
            if (request.Status == "confirmed" && shared.Sum(s => Rules(s.Offer.Policy).Capacity) + Rules(offer.Policy).Capacity > reservation.RequiredCapacity) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Overlapping project allocations exceed the booked capacity.");
        }
        if (row is null) { row = new() { Id = Guid.NewGuid(), OfferId = offerId }; db.EventActivitySpaceRequests.Add(row); }
        row.Kind = request.Kind; row.ReservationId = request.Kind == "internal" ? request.ReservationId : null; row.NameEn = request.Name.En; row.NameZh = request.Name.Zh;
        row.Status = request.Status; row.Evidence = request.Evidence ?? ""; row.RecordedByMemberId = actor; row.RecordedUtc = DateTime.UtcNow; row.ConcurrencyToken = Guid.NewGuid(); offer.Status = "draft"; offer.ConcurrencyToken = Guid.NewGuid();
        Remember(eventId, actor, "space", input, key!, row.Id); Audit(eventId, actor, "space", evidence: request.Evidence);
        await invalidation.InvalidateForOccurrenceModuleChangeAsync(e, offer.OccurrenceId, actor, "PLACE.RESOURCE", "event.activity.spaceChanged", "governanceCritical", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); await cache.RemoveGroupEventsAsync(e.GroupId, ct); return await GetAsync(eventId, actor, ct);
    }
}
