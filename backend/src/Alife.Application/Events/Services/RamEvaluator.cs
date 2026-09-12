using System.Text.Json;
using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

/// <summary>Pure server-owned scoring. A product has no implied colour.</summary>
public static class RamEvaluator
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Json);
    public static RamV2Draft Parse(string json) => JsonSerializer.Deserialize<RamV2Draft>(json, Json) ?? new();
    public static bool HasText(RamText? text) => text is not null && (!string.IsNullOrWhiteSpace(text.En) || !string.IsNullOrWhiteSpace(text.Zh));
    private static bool Bilingual(RamText? text) => text is not null && !string.IsNullOrWhiteSpace(text.En) && !string.IsNullOrWhiteSpace(text.Zh);
    public static int Rank(string level) => level switch { "Green" => 1, "Yellow" => 2, "Red" => 3, _ => 0 };
    public static string Level(RamPolicyData? policy, int? likelihood, int? impact) =>
        Valid(likelihood) && Valid(impact)
            ? policy?.Matrix.FirstOrDefault(x => x.Likelihood == likelihood && x.Impact == impact)?.Level ?? "Incomplete"
            : "Incomplete";
    private static bool Valid(int? score) => score is >= 1 and <= 5;

    public static IReadOnlyList<string> ValidatePolicy(RamPolicyData p, bool publishing)
    {
        var errors = new List<string>();
        if (p is null || p.Likelihood is null || p.Impact is null || p.Matrix is null || p.Categories is null || p.Questions is null || p.ReviewRules is null)
            return ["ram.policy.shape: Policy sections are required."];
        if (p.Likelihood.Any(x=>x is null) || p.Impact.Any(x=>x is null) || p.Matrix.Any(x=>x is null) || p.Categories.Any(x=>x is null) || p.Questions.Any(x=>x is null))
            return ["ram.policy.shape: Policy entries cannot be null."];
        foreach (var scale in new[] { p.Likelihood, p.Impact })
            if (scale.Length != 5 || !scale.Select(x => x.Value).Order().SequenceEqual(Enumerable.Range(1,5)) || scale.Any(x => !Bilingual(x.Label) || !Bilingual(x.Description)))
                errors.Add("ram.policy.scale: Five bilingual definitions numbered 1–5 are required.");
        if (p.Matrix.Length != 25 || p.Matrix.Select(x => (x.Likelihood,x.Impact)).Distinct().Count() != 25 || p.Matrix.Any(x => !Valid(x.Likelihood) || !Valid(x.Impact) || (x.Level is not null && Rank(x.Level) == 0)))
            errors.Add("ram.policy.matrix: All 25 unique cells are required; colours must be Green, Yellow or Red.");
        if (publishing && p.Matrix.Any(x => Rank(x.Level ?? "") == 0)) errors.Add("ram.policy.unconfirmed: Confirm the colour of every cell before publishing.");
        if (!p.Categories.Select(x => x.Code).Order().SequenceEqual(RamPolicyDefaults.CategoryCodes.Order()) || p.Categories.Any(x => !Bilingual(x.Name) || !Bilingual(x.Guidance)))
            errors.Add("ram.policy.categories: The five SOP categories and bilingual guidance are required.");
        if (p.Questions.Length > 500 || p.Questions.GroupBy(x => (x.ActivityType,x.Code)).Any(x => x.Count() > 1) || p.Questions.Any(x => string.IsNullOrWhiteSpace(x.Code) || !RamPolicyDefaults.ActivityTypes.Contains(x.ActivityType) || !RamPolicyDefaults.CategoryCodes.Contains(x.CategoryCode) || !Bilingual(x.Text) || !Bilingual(x.Guidance)))
            errors.Add("ram.policy.questions: Use unique question codes per activity type and complete bilingual content.");
        foreach (var category in RamPolicyDefaults.CategoryCodes)
            if (!p.Questions.Any(x => x.ActivityType == "generic" && x.CategoryCode == category)) errors.Add($"ram.policy.generic.{category}: A generic question for every category is required.");
        if (p.ReviewRules.ReviewReminderDays is < 1 or > 365 || string.IsNullOrWhiteSpace(p.Source)) errors.Add("ram.policy.source: Source and a 1–365 day review reminder are required.");
        return errors;
    }

    public static IEnumerable<RamQuestion> Questions(RamPolicyData policy, RamActivity activity) =>
        policy.Questions.Where(x => x.ActivityType == "generic" || x.ActivityType == activity.Type);
    // Question keys include both activity identity and question set, never just question text/code.
    public static string QuestionKey(RamQuestion question) => $"{question.ActivityType}:{question.Code}";

    public static RamEvaluation Evaluate(RamV2Draft draft, RamPolicyData? policy)
    {
        var errors = new List<string>();
        if (draft.Activities is null || draft.Hazards is null || draft.Answers is null ||
            draft.Activities.Any(x=>x is null) || draft.Hazards.Any(x=>x is null) || draft.Answers.Any(x=>x is null)) throw new JsonException("RAM arrays and their entries cannot be null.");
        if (draft.Activities.Length == 0 || draft.Activities.Length > 50 || draft.Activities.Any(x => string.IsNullOrWhiteSpace(x.Id) || !HasText(x.Name)) || draft.Activities.Select(x => x.Id).Distinct().Count() != draft.Activities.Length)
            errors.Add("ram.activities: Add distinct activities with names.");
        if (draft.ParticipantCount is null or < 1) errors.Add("ram.participants: Confirm the participant count.");
        if (draft.AuthorAttendsAndLeads is null) errors.Add("ram.onsite: Confirm whether the author will attend and lead.");
        if (draft.AuthorAttendsAndLeads == false && !draft.OnsiteMemberId.HasValue) errors.Add("ram.onsite.member: Select the member who will attend and lead.");
        if (draft.IsOuting && !HasText(draft.WeatherConfirmation)) errors.Add("ram.weather: Record the weather review and contingency decision.");
        if (draft.IsOvernight && !HasText(draft.Accommodation)) errors.Add("ram.accommodation: Record confirmed accommodation arrangements.");
        if (draft.Hazards.Length == 0 || draft.Hazards.Length > 250) errors.Add("ram.hazards: Record at least one risk (maximum 250).");
        if (draft.Hazards.Select(x => x.Id).Distinct().Count() != draft.Hazards.Length || draft.Hazards.Any(x => string.IsNullOrWhiteSpace(x.Id))) errors.Add("ram.hazards.ids: Risks must have unique identities.");
        foreach (var a in draft.Activities)
        {
            if (!draft.Hazards.Any(x => x.ActivityId == a.Id)) errors.Add($"ram.activity.{a.Id}: Record risks for this activity.");
            if (policy is null) continue;
            foreach (var q in Questions(policy,a))
            {
                var answers = draft.Answers.Where(x => x.ActivityId == a.Id && x.QuestionCode == QuestionKey(q)).ToArray();
                if (answers.Length != 1 || (answers[0].NotApplicable ? !HasText(answers[0].Reason) : !HasText(answers[0].Answer)))
                    errors.Add($"ram.answer.{a.Id}.{QuestionKey(q)}: Answer the question or explain why it is not applicable.");
            }
        }
        foreach (var risk in draft.Hazards)
        {
            risk.RiskScore = Valid(risk.Likelihood) && Valid(risk.Impact) ? risk.Likelihood * risk.Impact : null;
            risk.ResidualScore = Valid(risk.ResidualLikelihood) && Valid(risk.ResidualImpact) ? risk.ResidualLikelihood * risk.ResidualImpact : null;
            risk.InitialLevel = Level(policy,risk.Likelihood,risk.Impact);
            risk.ResidualLevel = Level(policy,risk.ResidualLikelihood,risk.ResidualImpact);
            if (!draft.Activities.Any(x => x.Id == risk.ActivityId) || !RamPolicyDefaults.CategoryCodes.Contains(risk.CategoryCode) || !HasText(risk.Hazard) || !HasText(risk.Consequence) || !HasText(risk.ControlMeasures) || string.IsNullOrWhiteSpace(risk.PersonResponsible) || risk.RiskScore is null || risk.ResidualScore is null)
                errors.Add($"ram.risk.{risk.Id}: Complete the activity, category, hazard, consequence, both ratings, controls and responsible person.");
            if ((risk.InitialLevel == "Yellow" || risk.ResidualLevel == "Yellow") && !HasText(risk.AdditionalAction)) errors.Add($"ram.yellow.{risk.Id}: Yellow risk requires additional controls.");
        }
        if (policy is null || policy.Matrix.Any(x => Rank(x.Level ?? "") == 0)) errors.Add("ram.policy.unpublished: A fully confirmed, published church policy is required.");
        // Incomplete content must never be presented as a low overall risk.
        var overall = errors.Count != 0 ? "Incomplete" : draft.Hazards.OrderByDescending(x => Rank(x.ResidualLevel)).FirstOrDefault()?.ResidualLevel ?? "Incomplete";
        return new(draft,overall,errors);
    }
}
