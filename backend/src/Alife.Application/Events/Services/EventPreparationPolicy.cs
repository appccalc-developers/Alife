using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using System.Text.Json;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public static class EventPreparationPolicy
{
    public static bool ChangesTemplate(EventPlanSnapshotDto? saved, EventPlanComposeRequest input) =>
        saved?.Plan.ActivityTypeCode is not null &&
        (saved.Plan.ActivityTypeCode != input.ActivityTypeCode || saved.Plan.ArchetypeCode != input.ArchetypeCode);
    public const string TemplateLockedMessage = "The template is fixed after creation. Edit event details and arrangements instead. / 活动创建后模板不可更换，请修改活动资料和安排。";
    public const string FrozenMessage = "event.preparation.frozen: Approved preparation is read-only. Request approval revocation before editing. / 活动方案已批准并冻结，请先申请撤销审批再修改。";
    public const string PlanReviewMessage = "event.preparation.planReviewRequired: Details changed. Review and confirm the plan in Arrangements before formal approval. / 活动资料已改变，请在活动安排中查看并确认新方案，再提交正式审批。";

    // Explicit lifecycle Events have a saved human-reviewed brief. Recomposition
    // must not restore old visibility/registration facts after that brief changes.
    public static EventPlanComposeRequest WithSavedDetails(GroupEvent item, EventPlanComposeRequest composition)
    {
        if (item.PublicationStatus == EventPublicationStatus.LegacyImplicit) return composition;
        var facts = SavedDetailFacts(item);
        return composition with { Facts = new(composition.Facts.Items.Where(x => !facts.ContainsKey(x.Code))
            .Concat(facts.Select(x => new EventFactInputDto(x.Key, JsonSerializer.SerializeToElement(x.Value), EventFactCertainty.Confirmed, EventFactSource.Human))).ToArray()) };
    }

    public static bool NeedsPlanReview(GroupEvent item, EventPlanProposalDto plan)
    {
        if (item.PublicationStatus == EventPublicationStatus.LegacyImplicit) return false;
        // Older accepted plans may predate these brief facts; preserve that contract.
        return SavedDetailFacts(item).Where(expected => plan.Facts.Items.Any(fact => fact.Code == expected.Key &&
            fact.Certainty == EventFactCertainty.Confirmed && fact.Value is { ValueKind: JsonValueKind.String })).Any(expected => !plan.Facts.Items.Any(fact => fact.Code == expected.Key &&
            fact.Certainty == EventFactCertainty.Confirmed && fact.Value is { ValueKind: JsonValueKind.String } value && value.GetString() == expected.Value));
    }

    private static Dictionary<string, string> SavedDetailFacts(GroupEvent item)
    {
        using var data = JsonDocument.Parse(item.EventDataJson);
        var registration = data.RootElement.TryGetProperty("maxCapacity", out var capacity) && capacity.ValueKind == JsonValueKind.Number && capacity.TryGetInt32(out var count) && count > 0;
        return new() { ["visibility"] = EventVisibilityPolicy.ReadVisibility(item.EventDataJson), ["people.registrationMode"] = registration ? "required" : "none" };
    }
    // Expiry/invalidation blocks publication, but does not silently unlock approved preparation.
    public static IQueryable<EventPackage> FrozenPackages(IAlifeDbContext db, Guid eventId) => db.EventPackages.Where(x =>
        x.EventId == eventId && x.ScopeType == EventPackageScopeType.Event &&
        (x.Status == EventPackageStatus.Approved || x.Status == EventPackageStatus.ApprovedWithConditions) &&
        x.ApprovalValidityStatus != EventPackageApprovalValidity.Revoked);
    public static Task<bool> IsFrozenAsync(IAlifeDbContext db, Guid eventId, CancellationToken ct) =>
        FrozenPackages(db, eventId).AsNoTracking().AnyAsync(ct);
    public static async Task<bool> IsApprovedAsync(IAlifeDbContext db, Guid eventId, CancellationToken ct)
    {
        var package = await FrozenPackages(db, eventId).AsNoTracking().Include(x => x.Decisions)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        return EventPackageGateEvaluator.HasValidApproval(package, DateTime.UtcNow);
    }

    // Keep the freeze check and configuration commit in one transaction with Package approval.
    // Operational progress, consent and safety responses use their existing commands instead.
    public static async Task<bool> SaveEditableAsync(IAlifeDbContext db, Guid eventId, CancellationToken ct, bool transactionAlreadyStarted = false)
    {
        await using var transaction = transactionAlreadyStarted ? null : await db.BeginSerializableTransactionAsync(ct);
        if (await IsFrozenAsync(db, eventId, ct)) return false;
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return true;
    }
}
