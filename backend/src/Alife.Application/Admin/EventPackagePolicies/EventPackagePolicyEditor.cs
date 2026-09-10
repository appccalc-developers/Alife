using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.EventPackagePolicies;

public sealed record PolicyOption(string Code, LocalizedTextDto Label);
public sealed record PolicyEditorDefaults(JsonElement Rules, IReadOnlyList<PolicyOption> Facts,
    IReadOnlyList<PolicyOption> ActivityTypes, IReadOnlyList<PolicyOption> Modules);
public sealed record PolicyImpact(Guid? CurrentPolicyId, int AffectedEventCount, int AffectedApprovalCount, string ImpactToken);
public sealed record GetPolicyEditorDefaultsQuery(Guid MemberId) : IRequest<AppResult<PolicyEditorDefaults>>;
public sealed record PreviewPolicyQuery(Guid MemberId, PublishEventPackagePolicyRequest Request) : IRequest<AppResult<PolicyImpact>>;

public static class EventPackagePolicyEditor
{
    public static readonly PolicyOption[] Facts =
    [
        new("people.volunteersRequired", new("Volunteers required", "需要同工")),
        new("money.hasMoneyFlow", new("Money involved", "涉及费用收支")),
        new("safety.requiresRam", new("Risk assessment required", "需要风险评估")),
        new("people.childrenPresent", new("Children participating", "儿童参与")),
        new("programme.productionRequired", new("Managed programme", "需要节目制作")),
        new("place.resourcesRequired", new("Venue resources required", "需要场地资源")),
        new("move.transportRequired", new("Transport required", "需要交通安排")),
        new("move.accommodationRequired", new("Accommodation required", "需要住宿安排")),
        new("food.serviceRequired", new("Food service required", "需要餐饮服务")),
        new("scale.multiZone", new("Multiple operating zones", "多区域现场运营")),
        new("comms.followupRequired", new("Follow-up required", "需要跟进")),
        new("event.exists", new("Every event", "所有活动"))
    ];

    public static JsonElement DefaultRules(DateTime now) => JsonSerializer.SerializeToElement(new
    {
        schemaVersion = "1", preEventConfirmationWindowHours = 72,
        tierRules = new[] {
            Tier("light", [], [], []),
            Tier("standard", ["money.hasMoneyFlow", "place.resourcesRequired"], [], ["PEOPLE.REGISTRATION", "PLACE.RESOURCE", "MONEY.FINANCE"]),
            Tier("enhanced", ["people.childrenPresent", "move.transportRequired", "move.accommodationRequired", "safety.requiresRam"], ["outdoor-activity"], ["SAFEGUARDING.CHILD", "SAFETY.RAM", "MOVE.STAY", "FESTIVAL.OPERATIONS"])
        },
        authorityByTier = new { light = new { minimumApproverCount = 1 }, standard = new { minimumApproverCount = 1 }, enhanced = new { minimumApproverCount = 1 } },
        approvalValidityByTier = new { light = "P30D", standard = "P14D", enhanced = "P7D" },
        materialChangeRules = Array.Empty<string>(), conditionWaiverAllowed = false,
        delegationRules = new { enabled = false, allowedTiers = Array.Empty<string>() },
        legacyRollout = new { effectiveFromUtc = now, transitionDeadlineUtc = now.AddDays(90),
            cohortRule = "new-events-first", safetyCriticalModuleCodes = new[] { "SAFETY.RAM", "SAFEGUARDING.CHILD" },
            transitionByMode = new { off = "legacyReadOnlyPackage", dryRun = "timeLimitedCompatibility", enforced = "formalPackageRequired" } }
    });

    private static object Tier(string tier, string[] facts, string[] types, string[] modules) => new
    { tier, whenAnyConfirmedFactCodes = facts, whenAnyActivityTypeCodes = types, whenAnyModuleCodes = modules };

    internal static IQueryable<GroupEvent> AffectedEvents(IAlifeDbContext db, Guid? scope, DateTime now)
        => db.GroupEvents.Where(x => !x.IsDeleted && (scope.HasValue ? x.GroupId == scope.Value :
            !db.EventPackageGovernancePolicyVersions.Any(p => p.OrganisationId == x.GroupId && p.IsPublished &&
                p.EffectiveFromUtc <= now && (!p.RetiredUtc.HasValue || p.RetiredUtc > now))));

    internal static async Task<PolicyImpact> Impact(IAlifeDbContext db, Guid? scope, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var current = await db.EventPackageGovernancePolicyVersions.AsNoTracking().Where(x => x.OrganisationId == scope &&
            x.IsPublished && x.EffectiveFromUtc <= now && (!x.RetiredUtc.HasValue || x.RetiredUtc > now))
            .OrderByDescending(x => x.EffectiveFromUtc).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        var events = await AffectedEvents(db, scope, now).Select(x => x.Id).OrderBy(x => x).ToListAsync(ct);
        var approvals = await db.EventPackages.AsNoTracking().Where(x => events.Contains(x.EventId) &&
            x.ApprovalValidityStatus == EventPackageApprovalValidity.Active).Select(x => x.Id).OrderBy(x => x).ToListAsync(ct);
        return new(current, events.Count, approvals.Count, EventPackageCanonicalizer.HashCanonical(new { current, events, approvals }));
    }
}

public sealed class GetPolicyEditorDefaultsHandler(IAlifeDbContext db, IEventActivityTemplateCatalog templates)
    : IRequestHandler<GetPolicyEditorDefaultsQuery, AppResult<PolicyEditorDefaults>>
{
    public async Task<AppResult<PolicyEditorDefaults>> Handle(GetPolicyEditorDefaultsQuery request, CancellationToken ct)
    {
        if (!await ListEventPackagePoliciesQueryHandler.CanManage(db, request.MemberId, ct))
            return AppResult<PolicyEditorDefaults>.Forbidden("Event Package policy administration permission is required.");
        var types = (await templates.ListAsync(true, ct)).ToDictionary(x => x.Definition.Code, x => x.Definition);
        return AppResult<PolicyEditorDefaults>.Success(new(EventPackagePolicyEditor.DefaultRules(DateTime.UtcNow),
            EventPackagePolicyEditor.Facts, types.Values.Select(x => new PolicyOption(x.Code, x.Name)).ToArray(),
            EventCompositionDefinitions.Modules.Select(x => new PolicyOption(x.Code, x.Name)).ToArray()));
    }
}

public sealed class PreviewPolicyHandler(IAlifeDbContext db, IEventActivityTemplateCatalog templates)
    : IRequestHandler<PreviewPolicyQuery, AppResult<PolicyImpact>>
{
    public async Task<AppResult<PolicyImpact>> Handle(PreviewPolicyQuery query, CancellationToken ct)
    {
        if (!await ListEventPackagePoliciesQueryHandler.CanManage(db, query.MemberId, ct))
            return AppResult<PolicyImpact>.Forbidden("Event Package policy administration permission is required.");
        var error = EventPackagePolicyRules.Validate(query.Request, (await templates.ListAsync(true, ct)).Select(x => x.Definition.Code).ToHashSet());
        if (error is not null) return AppResult<PolicyImpact>.Validation(error);
        var impact = await EventPackagePolicyEditor.Impact(db, query.Request.OrganisationId, ct);
        if (query.Request.ExpectedCurrentPolicyId.HasValue && query.Request.ExpectedCurrentPolicyId != (impact.CurrentPolicyId ?? Guid.Empty))
            return AppResult<PolicyImpact>.Conflict("The current policy changed. Refresh and review again.");
        return AppResult<PolicyImpact>.Success(impact);
    }
}
