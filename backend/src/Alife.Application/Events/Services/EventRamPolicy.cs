using System.Text.Json;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public static class EventRamPolicy
{
    public static bool IsValidJson(string ramDataJson)
    {
        try
        {
            using var document = JsonDocument.Parse(ramDataJson);
            return document.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static IReadOnlyList<string> ValidateForReview(string ramDataJson)
    {
        var errors = new List<string>();
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(ramDataJson);
        }
        catch (JsonException)
        {
            return ["RAM data must be valid JSON."];
        }

        using (document)
        {
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return ["RAM data must be a JSON object."];
            }

            RequireBilingual(root, "activityName", errors);
            RequireBilingual(root, "activityDescription", errors);
            RequireBilingual(root, "participantAgeRange", errors);
            RequirePositiveInteger(root, "participantCount", errors);

            if (!root.TryGetProperty("leaderConfirmed", out var leaderConfirmed) ||
                leaderConfirmed.ValueKind is not JsonValueKind.True)
            {
                errors.Add("The group leader must confirm the RAM information before review.");
            }

            if (!root.TryGetProperty("missingInformation", out var missingInformation) ||
                missingInformation.ValueKind != JsonValueKind.Array)
            {
                errors.Add("missingInformation must be an array.");
            }
            else if (missingInformation.GetArrayLength() > 0)
            {
                errors.Add("Resolve every item marked as missing before requesting review.");
            }

            if (!root.TryGetProperty("hazards", out var hazards) ||
                hazards.ValueKind != JsonValueKind.Array ||
                hazards.GetArrayLength() == 0)
            {
                errors.Add("At least one hazard is required.");
            }
            else
            {
                var index = 0;
                foreach (var hazard in hazards.EnumerateArray())
                {
                    RequireBilingual(hazard, "hazard", errors, $"hazards[{index}].");
                    RequireScore(hazard, "likelihood", errors, index);
                    RequireScore(hazard, "impact", errors, index);
                    RequireRiskScore(hazard, errors, index);
                    RequireBilingual(hazard, "controlMeasures", errors, $"hazards[{index}].");
                    RequireText(hazard, "personResponsible", errors, $"hazards[{index}].");
                    index++;
                }
            }

            if (!root.TryGetProperty("emergencyContacts", out var contacts) ||
                contacts.ValueKind != JsonValueKind.Array ||
                contacts.GetArrayLength() == 0)
            {
                errors.Add("At least one emergency contact is required.");
            }
            else
            {
                var index = 0;
                foreach (var contact in contacts.EnumerateArray())
                {
                    RequireBilingual(contact, "role", errors, $"emergencyContacts[{index}].");
                    RequireText(contact, "name", errors, $"emergencyContacts[{index}].");
                    RequireText(contact, "phone", errors, $"emergencyContacts[{index}].");
                    index++;
                }
            }

            if (!root.TryGetProperty("isOuting", out var isOuting) ||
                isOuting.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            {
                errors.Add("isOuting must be confirmed.");
            }
            else if (isOuting.GetBoolean())
            {
                ValidateOutingSafety(root, errors);
            }
        }

        return errors;
    }

    public static EventRamAssessmentDto ToDto(EventRamAssessment ram, Guid groupId) =>
        new(
            ram.EventId,
            groupId,
            ram.RamDataJson,
            ram.Status,
            ram.SubmittedByMemberId,
            ram.SubmittedUtc,
            ram.ApprovedByMemberId,
            ram.ApprovedUtc,
            ram.CreatedUtc,
            ram.UpdatedUtc);

    private static void ValidateOutingSafety(JsonElement root, List<string> errors)
    {
        if (!root.TryGetProperty("outingSafety", out var safety) || safety.ValueKind != JsonValueKind.Object)
        {
            errors.Add("outingSafety is required for outings.");
            return;
        }

        RequireConfirmed(safety, "venueRiskAssessed", errors);
        RequireConfirmed(safety, "firstAidKitAvailable", errors);
        RequireText(safety, "trainedFirstAiderName", errors, "outingSafety.");
        RequireConfirmed(safety, "trainedFirstAiderQualificationConfirmed", errors);
        RequireConfirmed(safety, "participantHealthNeedsReviewed", errors);
        RequireConfirmed(safety, "weatherPlanReviewed", errors);

        if (!safety.TryGetProperty("transportRequired", out var transportRequired) ||
            transportRequired.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            errors.Add("outingSafety.transportRequired must be confirmed.");
            return;
        }

        if (transportRequired.GetBoolean())
        {
            RequireConfirmed(safety, "licensedDriverConfirmed", errors);
            RequireConfirmed(safety, "vehicleRegistrationConfirmed", errors);
            RequireConfirmed(safety, "vehicleWofConfirmed", errors);
        }
    }

    private static void RequireBilingual(JsonElement parent, string property, List<string> errors, string prefix = "")
    {
        if (!parent.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{prefix}{property} must contain zh and en text.");
            return;
        }

        RequireText(value, "zh", errors, $"{prefix}{property}.");
        RequireText(value, "en", errors, $"{prefix}{property}.");
    }

    private static void RequireText(JsonElement parent, string property, List<string> errors, string prefix = "")
    {
        if (!parent.TryGetProperty(property, out var value) ||
            value.ValueKind != JsonValueKind.String ||
            string.IsNullOrWhiteSpace(value.GetString()))
        {
            errors.Add($"{prefix}{property} is required.");
        }
    }

    private static void RequirePositiveInteger(JsonElement parent, string property, List<string> errors)
    {
        if (!parent.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var number) || number < 1)
        {
            errors.Add($"{property} must be a positive integer.");
        }
    }

    private static void RequireScore(JsonElement hazard, string property, List<string> errors, int index)
    {
        if (!hazard.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var score) || score is < 1 or > 5)
        {
            errors.Add($"hazards[{index}].{property} must be between 1 and 5.");
        }
    }

    private static void RequireRiskScore(JsonElement hazard, List<string> errors, int index)
    {
        var likelihood = 0;
        var impact = 0;
        var riskScore = 0;
        var hasLikelihood = hazard.TryGetProperty("likelihood", out var likelihoodElement) && likelihoodElement.ValueKind == JsonValueKind.Number && likelihoodElement.TryGetInt32(out likelihood);
        var hasImpact = hazard.TryGetProperty("impact", out var impactElement) && impactElement.ValueKind == JsonValueKind.Number && impactElement.TryGetInt32(out impact);
        var hasRiskScore = hazard.TryGetProperty("riskScore", out var scoreElement) && scoreElement.ValueKind == JsonValueKind.Number && scoreElement.TryGetInt32(out riskScore);
        if (!hasLikelihood || !hasImpact || !hasRiskScore || riskScore != likelihood * impact)
        {
            errors.Add($"hazards[{index}].riskScore must equal likelihood multiplied by impact.");
        }
    }

    private static void RequireConfirmed(JsonElement parent, string property, List<string> errors)
    {
        if (!parent.TryGetProperty(property, out var value) || value.ValueKind is not JsonValueKind.True)
        {
            errors.Add($"outingSafety.{property} must be confirmed.");
        }
    }
}
