using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventRamDecisionPolicy
{
    public const string DecisionKey = "ram.approval";

    public static EventDecisionRecord RequestReview(
        EventPlan plan,
        Guid requestedByMemberId,
        DateTime ramUpdatedUtc,
        DateTime now)
    {
        CancelPending(plan, requestedByMemberId, "Replaced by a newer RAM review request.", now);
        var module = plan.Modules.FirstOrDefault(x => x.IsRequired && x.ModuleKey == "ram");
        var decision = new EventDecisionRecord
        {
            Id = Guid.NewGuid(),
            EventPlanId = plan.Id,
            ModuleInstanceId = module?.Id,
            DecisionKey = DecisionKey,
            Status = EventDecisionStatus.Requested,
            RequestedByMemberId = requestedByMemberId,
            RequestJson = JsonSerializer.Serialize(new
            {
                planRevision = plan.CurrentRevision,
                ramUpdatedUtc
            }),
            RequestedUtc = now
        };
        plan.Decisions.Add(decision);
        return decision;
    }

    public static EventDecisionRecord? LatestPending(EventPlan? plan) => plan?.Decisions
        .Where(x => x.DecisionKey == DecisionKey && x.Status == EventDecisionStatus.Requested)
        .OrderByDescending(x => x.RequestedUtc)
        .FirstOrDefault();

    public static EventDecisionRecord? Latest(EventPlan? plan) => plan?.Decisions
        .Where(x => x.DecisionKey == DecisionKey)
        .OrderByDescending(x => x.RequestedUtc)
        .FirstOrDefault();

    public static void InvalidateApproval(EventPlan? plan, Guid actorMemberId, string reason, DateTime now)
    {
        if (plan is null) return;
        var latest = Latest(plan);
        if (latest is null || latest.Status is EventDecisionStatus.Cancelled or EventDecisionStatus.Returned or EventDecisionStatus.Rejected)
            return;

        if (latest.Status == EventDecisionStatus.Requested)
        {
            latest.Status = EventDecisionStatus.Cancelled;
            latest.DecidedByMemberId = actorMemberId;
            latest.DecisionNotes = reason;
            latest.DecidedUtc = now;
            return;
        }

        var module = plan.Modules.FirstOrDefault(x => x.IsRequired && x.ModuleKey == "ram");
        plan.Decisions.Add(new EventDecisionRecord
        {
            Id = Guid.NewGuid(),
            EventPlanId = plan.Id,
            ModuleInstanceId = module?.Id,
            DecisionKey = DecisionKey,
            Status = EventDecisionStatus.Cancelled,
            RequestedByMemberId = actorMemberId,
            DecidedByMemberId = actorMemberId,
            RequestJson = JsonSerializer.Serialize(new { invalidatedDecisionId = latest.Id }),
            DecisionNotes = reason,
            RequestedUtc = now,
            DecidedUtc = now
        });
    }

    public static string ResetLeaderConfirmation(string ramDataJson)
    {
        try
        {
            if (JsonNode.Parse(ramDataJson) is JsonObject root)
            {
                root["leaderConfirmed"] = false;
                return root.ToJsonString();
            }
        }
        catch (JsonException) { }
        return ramDataJson;
    }

    private static void CancelPending(EventPlan plan, Guid actorMemberId, string reason, DateTime now)
    {
        foreach (var pending in plan.Decisions.Where(x => x.DecisionKey == DecisionKey && x.Status == EventDecisionStatus.Requested))
        {
            pending.Status = EventDecisionStatus.Cancelled;
            pending.DecidedByMemberId = actorMemberId;
            pending.DecisionNotes = reason;
            pending.DecidedUtc = now;
        }
    }
}
