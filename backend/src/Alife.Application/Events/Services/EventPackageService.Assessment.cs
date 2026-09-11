using System.Text.Json;
using Alife.Application.Admin.EventPackagePolicies;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventPackageService
{
    public async Task<AppResult<EventApprovalAssessmentDto>> GetApprovalAssessmentAsync(Guid eventId, Guid memberId,
        EventPackageScopeType scopeType, Guid? scopeId, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventApprovalAssessmentDto, Alife.Domain.Entities.GroupEvent>(access);
        var capture = await CaptureAsync(eventId, new(scopeType, scopeId), ct);
        return capture.IsSuccess ? AppResult<EventApprovalAssessmentDto>.Success(capture.Value!.Manifest.ApprovalAssessment!) :
            Failure<EventApprovalAssessmentDto, PackageCapture>(capture);
    }

    private static EventApprovalAssessmentDto BuildApprovalAssessment(EventPlanProposalDto plan, PolicyRules rules,
        IReadOnlyList<ModuleDecisionDto> selected, EventGovernanceTier tier, string policyVersion, DateTime deadline)
    {
        var trueFacts = plan.Facts.Items.Where(x => x.Certainty == EventFactCertainty.Confirmed && x.Value is { ValueKind: JsonValueKind.True })
            .Select(x => x.Code).ToHashSet(StringComparer.Ordinal);
        var tiers = new[] { EventGovernanceTier.Enhanced, EventGovernanceTier.Standard, EventGovernanceTier.Light }.Select(level => {
            var reasons = new List<EventPackageReasonDto>();
            foreach (var rule in rules.TierRules.Where(x => x.Tier == level)) {
                foreach (var code in rule.WhenAnyConfirmedFactCodes.Where(trueFacts.Contains).Distinct()) {
                    var label = EventPackagePolicyEditor.Facts.FirstOrDefault(x => x.Code == code)?.Label ?? new LocalizedTextDto(code, code);
                    reasons.Add(new($"event.governance.fact.{code}", new($"Confirmed: {label.En}.", $"已确认：{label.Zh}。")));
                }
                foreach (var module in selected.Where(x => rule.WhenAnyModuleCodes.Contains(x.ModuleCode)))
                    reasons.Add(new($"event.governance.module.{module.ModuleCode}", new($"Enabled tool: {module.Label.En}.", $"已启用功能：{module.Label.Zh}。")));
                if (plan.ActivityTypeCode is { } codeType && rule.WhenAnyActivityTypeCodes.Contains(codeType)) {
                    var label = EventCompositionDefinitions.ActivityTypesByCode.GetValueOrDefault(codeType)?.Name ?? new LocalizedTextDto(codeType, codeType);
                    reasons.Add(new($"event.governance.template.{codeType}", new($"Selected template: {label.En}.", $"所选模板：{label.Zh}。")));
                }
            }
            if (level == EventGovernanceTier.Light) reasons.Add(new("event.governance.lightBaseline", new(
                tier == level ? "No Standard or Enhanced policy condition is triggered." : "Light is the baseline; a matching stricter tier takes precedence.",
                tier == level ? "未触发标准审批或加强审批的政策条件。" : "简易审批为基础等级；符合更高等级的条件时，采用更高等级。")));
            return new EventApprovalTierAssessmentDto(level, level == EventGovernanceTier.Light || reasons.Count > 0,
                tier == level, reasons.DistinctBy(x => x.Code).ToArray());
        }).ToArray();
        return new(tier, policyVersion, deadline.AddHours(-rules.PreEventConfirmationWindowHours), rules.PreEventConfirmationWindowHours, tiers);
    }

}
