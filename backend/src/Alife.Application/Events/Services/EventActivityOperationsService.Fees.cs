using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventActivityOperationsService
{
    private async Task<bool> CurrencyConsistent(Guid eventId, IEnumerable<EventActivityOffer> offers, CancellationToken ct)
    {
        var eventPolicy = await db.EventRegistrationPolicies.AsNoTracking().FirstOrDefaultAsync(p => p.EventId == eventId, ct);
        if (eventPolicy is null) return false;
        var currency = EventRegistrationWorkService.Rules(eventPolicy).Currency;
        var source = await EventActivityPlanService.ReadAsync(db, eventId, ct);
        var activityIds = source?.Data.Activities.Select(a => a.Id).ToArray() ?? [];
        var policies = await db.EventActivityPolicyVersions.AsNoTracking().Where(p => p.EventId == eventId && p.IsCurrent && activityIds.Contains(p.ActivityId)).ToArrayAsync(ct);
        return policies.All(p => Rules(p).Currency == currency) && offers.All(o => Rules(o.Policy).Currency == currency) &&
            !await db.EventActivityParticipations.AnyAsync(p => p.Offer.EventId == eventId && activityIds.Contains(p.Offer.ActivityId) && p.SeatStatus != "cancelled" && p.SeatStatus != "expired" && p.Currency != currency, ct);
    }
    private sealed record FeeQuote(long FeeMinor, Guid FeePolicyVersionId, Guid? ExistingChargeId = null, Guid? NewChargeOfferId = null);

    private async Task<Dictionary<Guid, FeeQuote>> Quote(Guid participantId, EventActivityOffer[] offers, Guid[] removals, CancellationToken ct)
    {
        var existing = await db.EventActivityParticipations.AsNoTracking().Include(p => p.Offer)
            .Where(p => p.ParticipantId == participantId && !removals.Contains(p.Id) && p.SeatStatus != "cancelled" && p.SeatStatus != "expired").ToArrayAsync(ct);
        var policyIds = existing.Select(p => p.FeePolicyVersionId).ToArray();
        var policies = await db.EventActivityPolicyVersions.AsNoTracking().Where(p => policyIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var result = new Dictionary<Guid, FeeQuote>();
        foreach (var group in offers.OrderBy(o => o.StartUtc).ThenBy(o => o.Id).GroupBy(o => o.ActivityId))
        {
            Guid? newAnchorOffer = null;
            var previous = existing.FirstOrDefault(p => p.Offer.ActivityId == group.Key && policies.TryGetValue(p.FeePolicyVersionId, out var policy) && Rules(policy).FeeChargeScope == "oncePerSeries");
            foreach (var offer in group)
            {
                var rules = Rules(offer.Policy);
                if (rules.FeeChargeScope == "perOccurrence") result[offer.Id] = new(rules.FeeMinor, offer.PolicyVersionId);
                else if (previous is not null) result[offer.Id] = new(0, previous.FeePolicyVersionId, previous.ChargeParticipationId ?? previous.Id);
                else if (newAnchorOffer.HasValue) result[offer.Id] = new(0, result[newAnchorOffer.Value].FeePolicyVersionId, NewChargeOfferId: newAnchorOffer);
                else { newAnchorOffer = offer.Id; result[offer.Id] = new(rules.FeeMinor, offer.PolicyVersionId); }
            }
        }
        return result;
    }

    private async Task<EventActivityParticipation> Charge(EventActivityParticipation row, CancellationToken ct) => row.ChargeParticipationId.HasValue
        ? await db.EventActivityParticipations.FirstAsync(p => p.Id == row.ChargeParticipationId, ct) : row;

    private async Task<long> NetPaid(Guid chargeId, CancellationToken ct)
    {
        var payments = await db.EventActivityPayments.Where(p => p.ParticipationId == chargeId).ToArrayAsync(ct);
        return payments.Sum(p => p.Operation == "payment" ? p.AmountMinor : -p.AmountMinor);
    }
}
