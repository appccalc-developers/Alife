using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

/// <summary>Effective project operations cannot be hidden by an unchecked planning answer.</summary>
internal static class EventActivityPlanConsistency
{
    private static readonly IReadOnlyDictionary<string, string> ConfigurationQuestions =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["meal"] = "foodService", ["travel"] = "organizedTransport", ["stay"] = "organizedStay",
            ["programme"] = "programmeProduction", ["roster"] = "serviceTeam"
        };

    public static async Task<string?> ConflictAsync(IAlifeDbContext db, Guid eventId, ActivityPlanData plan, CancellationToken ct)
    {
        if (plan.QuestionnaireVersion != 2) return null;
        var policies = await db.EventActivityPolicyVersions.AsNoTracking()
            .Where(row => row.EventId == eventId && row.IsCurrent).ToArrayAsync(ct);
        var openOffers = await db.EventActivityOffers.AsNoTracking()
            .Where(row => row.EventId == eventId && row.Status == "open").ToArrayAsync(ct);
        var participatingProjects = await db.EventActivityParticipations.AsNoTracking()
            .Where(row => row.Offer.EventId == eventId && row.SeatStatus != "cancelled" &&
                row.SeatStatus != "expired")
            .Select(row => row.Offer.ActivityId).Distinct().ToArrayAsync(ct);
        var feeRows = await db.EventActivityParticipations.AsNoTracking()
            .Where(row => row.Offer.EventId == eventId)
            .Select(row => new { row.Id, row.Offer.ActivityId, row.ChargeParticipationId,
                row.FeeMinor, row.SeatStatus }).ToArrayAsync(ct);
        var payments = await db.EventActivityPayments.AsNoTracking()
            .Where(row => row.Participation.Offer.EventId == eventId)
            .Select(row => new { row.ParticipationId, row.Operation, row.AmountMinor }).ToArrayAsync(ct);
        var childParticipations = await db.EventActivityParticipations.AsNoTracking()
            .Where(row => row.Offer.EventId == eventId && row.Participant.IsChild &&
                row.SeatStatus != "cancelled" && row.SeatStatus != "expired")
            .Select(row => row.Offer.ActivityId).Distinct().ToArrayAsync(ct);
        var spaces = await db.EventActivitySpaceRequests.AsNoTracking()
            .Where(row => row.Offer.EventId == eventId && row.Offer.Status != "cancelled" &&
                row.Status != "cancelled" && row.Status != "refused")
            .Select(row => row.Offer.ActivityId).Distinct().ToArrayAsync(ct);
        var configurations = await db.EventActivityModuleConfigurations.AsNoTracking()
            .Where(row => row.EventId == eventId).ToArrayAsync(ct);
        foreach (var activity in plan.Activities)
        {
            bool On(string code) => activity.Answers?.TryGetValue(code, out var answer) == true && answer.Value == "yes";
            string Conflict(string code) => $"Project {activity.Id} still has effective {code} records. Clear or settle them before turning this arrangement off. / 项目 {activity.Id} 仍有关联的 {code} 记录；请先清理或结清，再关闭该安排。";
            if (!On("projectSelection") && (openOffers.Any(row => row.ActivityId == activity.Id) ||
                participatingProjects.Contains(activity.Id))) return Conflict("projectSelection");
            if (!On("minorsParticipate") && childParticipations.Contains(activity.Id)) return Conflict("minorsParticipate");
            if (!On("spaceReservation") && spaces.Contains(activity.Id)) return Conflict("spaceReservation");
            if (!On("projectFee"))
            {
                var projectFees = feeRows.Where(row => row.ActivityId == activity.Id).ToArray();
                var charges = projectFees.ToDictionary(row => row.Id);
                var chargeIds = projectFees.Select(row => row.ChargeParticipationId ?? row.Id).ToHashSet();
                if (projectFees.Any(row => row.SeatStatus is not ("cancelled" or "expired") &&
                        (row.FeeMinor > 0 || row.ChargeParticipationId.HasValue &&
                            (!charges.TryGetValue(row.ChargeParticipationId.Value, out var charge) || charge.FeeMinor > 0))) ||
                    payments.Where(row => chargeIds.Contains(row.ParticipationId))
                        .GroupBy(row => row.ParticipationId)
                        .Any(group => group.Sum(row => row.Operation == "payment" ? row.AmountMinor : -row.AmountMinor) > 0))
                    return Conflict("projectFee");
            }
            var policy = policies.FirstOrDefault(row => row.ActivityId == activity.Id);
            if (policy is not null)
            {
                var rules = EventActivityOperationsService.Rules(policy);
                if (!On("ageEligibility") && (rules.MinimumAge.HasValue || rules.MaximumAge.HasValue)) return Conflict("ageEligibility");
                if (!On("capacityLimit") && rules.Capacity > 0) return Conflict("capacityLimit");
                if (!On("projectFee") && rules.FeeMinor > 0) return Conflict("projectFee");
                if (!On("spaceReservation") && rules.NeedsSpace) return Conflict("spaceReservation");
            }
            var applicable = EventProjectQuestionCatalog.ApplicableQuestions(activity.Attributes).Select(q => q.Code).ToHashSet(StringComparer.Ordinal);
            foreach (var configuration in configurations.Where(row => row.ActivityId == activity.Id))
            {
                if (!ConfigurationQuestions.TryGetValue(configuration.Kind, out var code) ||
                    applicable.Contains(code) && On(code) || !HasEffectiveDetails(configuration.DetailsJson)) continue;
                return Conflict(code);
            }
        }
        return null;
    }

    private static bool HasText(LocalizedTextDto? text) => text is not null &&
        (!string.IsNullOrWhiteSpace(text.En) || !string.IsNullOrWhiteSpace(text.Zh));

    private static bool HasEffectiveDetails(string json)
    {
        try
        {
            var value = JsonSerializer.Deserialize<SaveProjectModuleConfigurationRequest>(json, RamEvaluator.Json);
            if (value is null) return true;
            return value.Meal is { } meal && (HasText(meal.ServiceMethod) || HasText(meal.PreparationPlace) ||
                       HasText(meal.DietaryHandling) || HasText(meal.FoodSafetyPlan)) ||
                   value.Travel is { } travel && (HasText(travel.Origin) || HasText(travel.Destination) ||
                       HasText(travel.Timetable) || travel.JourneyId.HasValue) ||
                   value.Stay is { } stay && (HasText(stay.Site) || HasText(stay.RoomingPlan) ||
                       stay.CheckInUtc.HasValue || stay.CheckOutUtc.HasValue) ||
                   value.Programme is { } programme && (HasText(programme.ProductionNotes) || programme.ProgramItemIds?.Count > 0) ||
                   value.Roster is { } roster && (HasText(roster.StaffingNotes) || roster.ServiceSlotIds?.Count > 0);
        }
        catch (JsonException) { return true; }
    }
}
