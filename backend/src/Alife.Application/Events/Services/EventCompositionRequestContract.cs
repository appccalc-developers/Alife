using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

/// <summary>
/// Validates the minimum complete write shape shared by Event creation and detail updates.
/// Semantic composition validation remains authoritative in <see cref="EventCompositionEngine"/>.
/// </summary>
public static class EventCompositionRequestContract
{
    public const string InvalidCompositionErrorCode = "event.composition.invalid";

    public static bool HasUnsupportedSchema(EventPlanComposeRequest? request) =>
        request is null || !EventCompositionDefinitions.IsSupportedSchema(request.SchemaVersion);

    public static string? ValidateComplete(EventPlanComposeRequest request)
    {
        if (request.Facts?.Items is null)
            return "facts.items is required in an Event 2.0 composition.";
        if (request.HumanSelections is null)
            return "humanSelections is required in an Event 2.0 composition.";
        if (request.ActivityPlan is null)
            return "activityPlan is required in an Event 2.0 composition.";
        if (EventActivityPlanService.Validate(request.ActivityPlan) is { } activityError)
            return activityError;
        if (request.ModuleConfirmations is null)
            return "moduleConfirmations is required in an Event 2.0 composition.";
        if (request.ModuleConfirmations.Count != EventCompositionDefinitions.Modules.Count ||
            EventCompositionDefinitions.Modules.Any(module =>
                !request.ModuleConfirmations.ContainsKey(module.Code)))
            return "moduleConfirmations must contain every current Event module exactly once.";
        if (request.ModuleConfirmations.Keys.Any(code =>
                !EventCompositionDefinitions.ModulesByCode.ContainsKey(code)))
            return "moduleConfirmations contains an unknown Event module.";
        return null;
    }
}
