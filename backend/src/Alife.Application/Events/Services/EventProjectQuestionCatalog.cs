using System.Text.RegularExpressions;
using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

/// <summary>System-owned project requirements; template answers are editable defaults, never approvals.</summary>
public static class EventProjectQuestionCatalog
{
    public static readonly string[] Answers = ["yes", "no", "unknown"];
    public static readonly string[] ProjectSwitchCodes =
    [
        "projectSelection", "ageEligibility", "capacityLimit", "projectFee",
        "minorsParticipate", "spaceReservation", "serviceTeam", "programmeProduction"
    ];
    public static readonly IReadOnlySet<string> GeneralSwitchCodes =
        ProjectSwitchCodes.ToHashSet(StringComparer.Ordinal);
    public static readonly IReadOnlyDictionary<string, string> MovedEventFactCodes =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["safetyReview"] = "safety.requiresRam",
            ["projectNotices"] = "comms.followupRequired",
            ["multiZoneOperations"] = "scale.multiZone"
        };
    public static readonly IReadOnlyDictionary<string, LocalizedTextDto> MovedEventQuestions =
        new Dictionary<string, LocalizedTextDto>(StringComparer.Ordinal)
        {
            ["safety.requiresRam"] = new("overall risk assessment", "总体风险评估"),
            ["comms.followupRequired"] = new("participant notices and follow-up", "参加者通知与跟进"),
            ["scale.multiZone"] = new("multi-zone operations", "多区域协同运营")
        };
    public static readonly EventProjectQuestionDefinitionDto[] Definitions =
    [
        Q("projectSelection", "Do participants need to select or register for this project?", "参加者是否需要选择或报名此项目？", [], ["PEOPLE.REGISTRATION"]),
        Q("ageEligibility", "Does this project have age eligibility requirements?", "此项目是否有年龄资格要求？", [], ["PEOPLE.REGISTRATION"]),
        Q("capacityLimit", "Does this project have a participant limit?", "此项目是否限制参加人数？", [], ["PEOPLE.REGISTRATION"]),
        Q("projectFee", "Does this project charge a registration fee?", "此项目是否收取报名费用？", [], ["PEOPLE.REGISTRATION", "MONEY.FINANCE"]),
        Q("minorsParticipate", "Will minors participate in this project?", "此项目是否有未成年人参加？", [], ["PEOPLE.REGISTRATION", "SAFEGUARDING.CHILD"]),
        Q("spaceReservation", "Does this project need a venue or room reservation?", "此项目是否需要预订场地或房间？", [], ["PLACE.RESOURCE"]),
        Q("serviceTeam", "Does this project need a service team or roster?", "此项目是否需要服务团队或排班？", [], ["SERVICE.ROSTER"]),
        Q("programmeProduction", "Does this project need programme or production planning?", "此项目是否需要流程或节目制作规划？", [], ["PROGRAM.PRODUCTION"]),
        Q("foodService", "Does this meal need organized food service?", "此聚餐是否需要组织食品服务？", ["meal"], ["FOOD.HOSPITALITY"]),
        Q("organizedTransport", "Does this transport involve an organized journey?", "此交通项目是否涉及统一组织的行程？", ["transport"], ["MOVE.STAY"]),
        Q("organizedStay", "Does this overnight project need organized accommodation?", "此过夜项目是否需要统一组织住宿？", ["camp"], ["MOVE.STAY", "SAFETY.RAM"]),
        Q("hikingRouteSafety", "Does this hike need route and hiking safety planning?", "此徒步项目是否需要路线和徒步安全规划？", ["hiking"], ["SAFETY.RAM"]),
        Q("waterSafety", "Does this water activity need water safety planning?", "此水上项目是否需要水上安全规划？", ["water"], ["SAFETY.RAM"]),
        Q("sportSafety", "Does this sport need sport safety planning?", "此运动项目是否需要运动安全规划？", ["sport"], ["SAFETY.RAM"]),
        Q("weatherPlan", "Does this outdoor project need a weather and contingency plan?", "此户外项目是否需要天气和应变方案？", ["outdoor"], ["SAFETY.RAM"]),
        Q("fitnessAttestation", "Does participation need a fitness or capability attestation?", "参加此项目是否需要体能或能力声明？", ["hiking", "water", "sport"], ["PEOPLE.REGISTRATION", "SAFETY.RAM"])
    ];
    public static readonly IReadOnlySet<string> Codes = Definitions.Select(q => q.Code).ToHashSet(StringComparer.Ordinal);

    public static bool AppliesTo(EventProjectQuestionDefinitionDto question, IEnumerable<string> attributes) =>
        question.AppliesToAttributes.Length == 0 || question.AppliesToAttributes.Any(attributes.Contains);
    public static EventProjectQuestionDefinitionDto[] ApplicableQuestions(IEnumerable<string> attributes) =>
        Definitions.Where(q => AppliesTo(q, attributes)).ToArray();
    public static IReadOnlyList<LocalizedTextDto> FormalBlockers(ActivityPlanData? activities)
    {
        var blockers = new List<LocalizedTextDto>();
        foreach (var activity in activities?.Activities ?? [])
        {
            if (!string.IsNullOrWhiteSpace(activity.SourcePresetKey) && !activity.PresetConfirmed)
                blockers.Add(new($"Confirm the template defaults for project {activity.Name.En} before formal submission.",
                    $"正式提交前，请人工确认项目「{activity.Name.Zh}」的模板预设。"));
            foreach (var question in ApplicableQuestions(activity.Attributes).Where(q => q.RequiredModules.Length > 0))
                if (activity.Answers is null || !activity.Answers.TryGetValue(question.Code, out var answer) || answer.Value is not ("yes" or "no") || !answer.Confirmed)
                    blockers.Add(new($"Confirm an explicit yes or no for project {activity.Name.En}: {question.Question.En}",
                        $"正式提交前，请明确确认项目「{activity.Name.Zh}」的答案为是或否：{question.Question.Zh}"));
        }
        return blockers;
    }
    public static string[] DemandedModules(IReadOnlyDictionary<string, string> answers, IEnumerable<string> attributes) =>
        ApplicableQuestions(attributes).Where(q => answers.TryGetValue(q.Code, out var value) && value == "yes")
            .SelectMany(q => q.RequiredModules).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
    public static string? ValidateAnswers(IReadOnlyDictionary<string, string>? answers) =>
        answers is null || answers.Count > Codes.Count ||
        answers.Any(a => !Codes.Contains(a.Key) || !Answers.Contains(a.Value))
            ? "Project answers must use fixed question codes and yes, no or unknown. / 项目答案须使用固定问题代码及 yes、no 或 unknown。" : null;
    public static string? ValidatePresetProjects(IReadOnlyList<EventTemplatePresetProjectDto>? projects)
    {
        if (projects is null || projects.Count > 50 || projects.Any(p => p is null) || projects.Select(p => p.PresetKey).Distinct(StringComparer.Ordinal).Count() != projects.Count)
            return "A template needs a preset-project array with at most 50 unique entries.";
        foreach (var project in projects)
        {
            if (string.IsNullOrWhiteSpace(project.PresetKey) || !Regex.IsMatch(project.PresetKey, "^[a-z][a-z0-9-]{0,79}$") ||
                project.Name is not { En: not null, Zh: not null } || string.IsNullOrWhiteSpace(project.Name.En) || string.IsNullOrWhiteSpace(project.Name.Zh) || project.Name.En.Length > 300 || project.Name.Zh.Length > 300 ||
                project.Conditions is not { En: not null, Zh: not null } || project.Conditions.En.Length > 4000 || project.Conditions.Zh.Length > 4000 ||
                !ActivityAttributes.Valid(project.Attributes))
                return "Invalid preset project key, bilingual content or fixed attributes.";
            if (ValidateAnswers(project.DefaultAnswers) is { } error) return error;
            if (project.EventFactSuggestions is { } suggestions &&
                (suggestions.Length > MovedEventFactCodes.Count ||
                 suggestions.Distinct(StringComparer.Ordinal).Count() != suggestions.Length ||
                 suggestions.Any(code => !MovedEventFactCodes.Values.Contains(code, StringComparer.Ordinal))))
                return "Preset Event fact suggestions must use unique moved Event fact codes.";
            if (!ValidDefaultConfiguration(project.DefaultConfiguration))
                return "Invalid preset project configuration defaults.";
        }
        return null;
    }
    public static bool ValidDefaultConfiguration(ProjectConfigurationDefaultsDto? defaults) => defaults is null ||
        defaults.MinimumAge is null or >= 0 and <= 130 &&
        defaults.MaximumAge is null or >= 0 and <= 130 &&
        (defaults.MinimumAge is null || defaults.MaximumAge is null || defaults.MinimumAge <= defaults.MaximumAge) &&
        defaults.Capacity is null or >= 0 and <= 1000000 &&
        defaults.FeeMinor is null or >= 0 and <= 100000000 &&
        (defaults.Currency is null || defaults.Currency.Length == 3 && defaults.Currency.All(char.IsAsciiLetterUpper)) &&
        defaults.FeeChargeScope is null or "perOccurrence" or "oncePerSeries" &&
        ValidOptionalText(defaults.Eligibility) && ValidOptionalText(defaults.Terms);
    private static bool ValidOptionalText(LocalizedTextDto? text) => text is null ||
        text is { En: not null, Zh: not null } && text.En.Length <= 4000 && text.Zh.Length <= 4000;
    private static EventProjectQuestionDefinitionDto Q(string code, string en, string zh, string[] attributes, string[] modules)
    {
        var dependencies = new List<string> { "TEAM.WORK" };
        if (modules.Contains("SAFEGUARDING.CHILD")) dependencies.Add("PEOPLE.REGISTRATION");
        if (modules.Contains("FESTIVAL.OPERATIONS")) dependencies.AddRange(["SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE"]);
        return new(code, new(en, zh), attributes, modules, dependencies.Distinct(StringComparer.Ordinal).ToArray(),
            modules.Where(m => m == "FESTIVAL.OPERATIONS").ToArray());
    }
}
