using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

/// <summary>Reviewed system presets. No amounts, venues, attendance, transport or safety approvals are invented.</summary>
public static class EventTemplateProjectDefaults
{
    public static EventTemplatePresetProjectDto[] ForTemplate(string code, bool repeatForEachOccurrence) => code switch
    {
        "shared-meal" => [P("shared-meal", "Shared meal", "共同用餐", ["meal"], repeatForEachOccurrence, "foodService")],
        "fellowship-social" => [P("fellowship", "Fellowship and conversation", "联谊交流", [], repeatForEachOccurrence)],
        "local-outing" => [P("visit", "Visits and sightseeing", "参访游览", [], repeatForEachOccurrence)],
        "outdoor-activity" => [P("outdoor-project", "Outdoor activity", "户外项目", ["outdoor"], repeatForEachOccurrence, "weatherPlan")],
        "church-camp" => [P("main-gathering", "Themed gathering", "主题聚会", [], repeatForEachOccurrence, "programmeProduction"), P("overnight-stay", "Overnight stay", "住宿安排", ["camp"], repeatForEachOccurrence, "organizedStay"), P("shared-meal", "Shared meal", "共同用餐", ["meal"], repeatForEachOccurrence, "foodService")],
        "spiritual-retreat" => [P("devotional-sharing", "Devotional reflection and sharing", "灵修分享", [], repeatForEachOccurrence, "programmeProduction"), P("overnight-stay", "Overnight stay", "住宿安排", ["camp"], repeatForEachOccurrence, "organizedStay")],
        "children-youth-camp" => [P("group-camp-activity", "Camp group activities", "分组营会活动", [], repeatForEachOccurrence, "minorsParticipate", "programmeProduction"), P("overnight-stay", "Overnight stay", "住宿安排", ["camp"], repeatForEachOccurrence, "organizedStay"), P("shared-meal", "Shared meal", "共同用餐", ["meal"], repeatForEachOccurrence, "foodService")],
        "training-camp" => [P("training-course", "Training course", "培训课程", [], repeatForEachOccurrence, "programmeProduction"), P("overnight-stay", "Overnight stay", "住宿安排", ["camp"], repeatForEachOccurrence, "organizedStay")],
        "small-group-fellowship" => [P("group-sharing", "Small-group sharing", "小组分享", [], repeatForEachOccurrence, "programmeProduction")],
        "worship-service" => [P("worship-message", "Worship and message", "敬拜与信息", [], repeatForEachOccurrence, "programmeProduction")],
        "bible-study-course" => [P("study-discussion", "Bible study and discussion", "查经与讨论", [], repeatForEachOccurrence, "programmeProduction")],
        "prayer-meeting" => [P("prayer", "Shared prayer", "共同祷告", [], repeatForEachOccurrence, "programmeProduction")],
        "community-festival" => [P("community-interaction", "Community interaction", "社区互动", [], repeatForEachOccurrence), P("live-programme", "Live programme", "现场节目", [], repeatForEachOccurrence, "programmeProduction")],
        "church-celebration" => [P("celebration-programme", "Celebration programme", "庆典节目", [], repeatForEachOccurrence, "programmeProduction"), P("welcome-conversation", "Welcome and conversation", "交流接待", [], repeatForEachOccurrence)],
        "public-outreach" => [P("outreach-conversation", "Outreach conversation", "外展交流", [], repeatForEachOccurrence)],
        "concert-performance" => [P("stage-performance", "Stage performance", "舞台演出", [], repeatForEachOccurrence, "programmeProduction")],
        _ => []
    };
    private static EventTemplatePresetProjectDto P(string key, string en, string zh, string[] attributes, bool repeat, params string[] yesAnswers)
    {
        var answers = EventProjectQuestionCatalog.Definitions.ToDictionary(q => q.Code,
            q => EventProjectQuestionCatalog.GeneralSwitchCodes.Contains(q.Code) ? "no" : "unknown",
            StringComparer.Ordinal);
        foreach (var code in yesAnswers) answers[code] = "yes";
        return new(key, new(en, zh), new("", ""), attributes, answers, repeat);
    }
}
