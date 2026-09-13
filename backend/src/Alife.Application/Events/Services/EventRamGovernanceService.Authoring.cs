using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed record RamAuthoringContext(RamPolicyDto? Policy, string SourceVersion, RamText Title);
public sealed record RamDraftCheckRequest(Guid? EventId, Guid? GroupId, string RamDataJson, Guid? PolicyVersionId = null);
public sealed record RamDraftIssue(string Field, RamText Message);
public sealed record RamDraftCheck(RamV2Draft Draft, string ResidualLevel, IReadOnlyList<RamDraftIssue> Issues, RamPolicyDto? Policy);

public sealed partial class EventRamGovernanceService
{
    // This projection deliberately carries no contacts, membership lists or RAM contents.
    public async Task<AppResult<RamAuthoringContext>> AuthoringContextAsync(Guid? eventId, Guid? groupId, Guid actor, CancellationToken ct)
    {
        if (eventId.HasValue == groupId.HasValue)
            return AppResult<RamAuthoringContext>.Validation("Choose exactly one Event or creation group. / 请选择活动或创建小组。");
        var title = new RamText();
        var source = "new";
        Guid? policyId = null;
        if (eventId.HasValue)
        {
            var e = await db.GroupEvents.AsNoTracking().Include(x => x.RamAssessment).FirstOrDefaultAsync(x => x.Id == eventId, ct);
            if (e is null) return AppResult<RamAuthoringContext>.NotFound("Event not found.");
            if (!await CanEdit(e, actor, ct)) return AppResult<RamAuthoringContext>.Forbidden("RAM editing permission is required.");
            if (await EventPreparationPolicy.IsFrozenAsync(db, e.Id, ct)) return AppResult<RamAuthoringContext>.Conflict(EventPreparationPolicy.FrozenMessage);
            groupId = e.GroupId;
            title = new(e.TitleEn, e.TitleZh);
            source = $"{e.UpdatedUtc.Ticks}:{Token(e.RamAssessment)}";
            policyId = e.RamAssessment?.PolicyVersionId;
        }
        else if (!await authorization.IsLeaderOrCoLeaderAsync(groupId!.Value, actor, ct) ||
                 !await db.Groups.AnyAsync(x => x.Id == groupId && !x.IsDissolved, ct))
            return AppResult<RamAuthoringContext>.Forbidden("Only group leaders and co-leaders can prepare a new Event RAM.");
        var church = await EventCompositionPersistence.FindChurchRootIdAsync(db, groupId!.Value, ct);
        var query = db.EventRamPolicyVersions.AsNoTracking().Where(x => x.ChurchId == church && x.IsPublished);
        var policy = policyId.HasValue ? await query.FirstOrDefaultAsync(x => x.Id == policyId, ct)
            : await query.OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        return AppResult<RamAuthoringContext>.Success(new(policy is null ? null : PolicyDto(policy), source, title));
    }

    public async Task<AppResult<RamDraftCheck>> CheckDraftAsync(RamDraftCheckRequest request, Guid actor, CancellationToken ct)
    {
        var context = await AuthoringContextAsync(request.EventId, request.GroupId, actor, ct);
        if (!context.IsSuccess) return context.Status switch
        {
            AppResultStatus.Forbidden => AppResult<RamDraftCheck>.Forbidden(context.Message!),
            AppResultStatus.NotFound => AppResult<RamDraftCheck>.NotFound(context.Message!),
            AppResultStatus.Conflict => AppResult<RamDraftCheck>.Conflict(context.Message!),
            _ => AppResult<RamDraftCheck>.Validation(context.Message!)
        };
        if (request.RamDataJson is null || request.RamDataJson.Length > 500_000)
            return AppResult<RamDraftCheck>.Validation("RAM draft is too large.");
        var policy = context.Value!.Policy;
        if (request.PolicyVersionId is { } selected && selected != policy?.Id)
        {
            if (policy is null) return AppResult<RamDraftCheck>.Validation("The policy is not published for this church.");
            var p = await db.EventRamPolicyVersions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == selected && x.ChurchId == policy.ChurchId && x.IsPublished, ct);
            if (p is null) return AppResult<RamDraftCheck>.Validation("The policy is not published for this church.");
            policy = PolicyDto(p);
        }
        try
        {
            var result = RamEvaluator.Evaluate(RamEvaluator.Parse(request.RamDataJson), policy?.Data);
            return AppResult<RamDraftCheck>.Success(new(result.Draft, result.ResidualLevel,
                result.Errors.Where(x => !x.StartsWith("ram.risk.")).Select(AuthoringIssue).Concat(RiskIssues(result.Draft)).ToArray(), policy));
        }
        catch (JsonException) { return AppResult<RamDraftCheck>.Validation("RAM must contain valid activities, risks and answers. / RAM 项目、风险和答案格式无效。"); }
    }

    private static IEnumerable<RamDraftIssue> RiskIssues(RamV2Draft draft)
    {
        for (var index = 0; index < draft.Hazards.Length; index++)
        {
            var r = draft.Hazards[index];
            var checks = new (string Field, bool Valid, string En, string Zh)[] {
                ("activityId", draft.Activities.Any(x => x.Id == r.ActivityId), "activity", "所属项目"),
                ("categoryCode", RamPolicyDefaults.CategoryCodes.Contains(r.CategoryCode), "category", "风险类别"),
                ("hazard", RamEvaluator.HasText(r.Hazard), "hazard", "危害"),
                ("consequence", RamEvaluator.HasText(r.Consequence), "consequence", "后果"),
                ("controlMeasures", RamEvaluator.HasText(r.ControlMeasures), "control measures", "控制措施"),
                ("personResponsible", !string.IsNullOrWhiteSpace(r.PersonResponsible), "responsible person", "负责人"),
                ("likelihood", r.Likelihood is >= 1 and <= 5, "initial likelihood", "初始可能性"),
                ("impact", r.Impact is >= 1 and <= 5, "initial impact", "初始影响"),
                ("residualLikelihood", r.ResidualLikelihood is >= 1 and <= 5, "residual likelihood", "剩余可能性"),
                ("residualImpact", r.ResidualImpact is >= 1 and <= 5, "residual impact", "剩余影响")
            };
            foreach (var check in checks.Where(x => !x.Valid)) yield return new($"ram.risk.{r.Id}.{check.Field}", new($"Risk {index + 1}: complete {check.En}.", $"风险 {index + 1}：请填写{check.Zh}。"));
        }
    }

    private static RamDraftIssue AuthoringIssue(string error)
    {
        var split = error.IndexOf(": ", StringComparison.Ordinal);
        var field = split < 0 ? error : error[..split];
        var en = split < 0 ? error : error[(split + 2)..];
        var zh = field switch
        {
            "ram.activities" => "请填写名称不同、身份唯一的活动项目。",
            "ram.participants" => "请确认参与人数。",
            "ram.onsite" => "请确认填表人是否亲自出席并领导。",
            "ram.onsite.member" => "请选择亲自出席并领导的成员。",
            "ram.weather" => "请填写天气核查及替代安排。",
            "ram.accommodation" => "请填写确认的住宿安排。",
            "ram.hazards" => "请填写至少一条风险，最多 250 条。",
            "ram.hazards.ids" => "风险身份不能重复。",
            "ram.policy.unpublished" => "需要所属教会已发布且矩阵已确认的政策，当前仍可保存草稿。",
            _ when field.StartsWith("ram.answer.") => "请回答此题，或填写不适用原因。",
            _ when field.StartsWith("ram.activity.") => "请为此活动项目填写风险。",
            _ when field.StartsWith("ram.yellow.") => "黄色风险需要填写额外控制措施。",
            _ => "请补齐所属项目、类别、危害、后果、初始及剩余评分、控制措施和负责人。"
        };
        return new(field, new(en, zh));
    }
}
