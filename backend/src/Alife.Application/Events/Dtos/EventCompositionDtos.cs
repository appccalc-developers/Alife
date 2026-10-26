using System.Text.Json;
using System.Text.Json.Serialization;
using Alife.Application.Events.Services;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record LocalizedTextDto(string En, string Zh);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record EventFactInputDto(
    string Code,
    JsonElement? Value,
    EventFactCertainty Certainty,
    EventFactSource Source,
    Guid? ConfirmedByMemberId = null,
    DateTime? ConfirmedUtc = null);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record EventFactSetInput(IReadOnlyList<EventFactInputDto> Items);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ModuleSelectionInput(string ModuleCode, bool Selected, string? Reason = null);

public sealed record HumanDecisionInput(string Code, string Decision, string? Reason = null);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record EventPlanComposeRequest(
    string SchemaVersion,
    string? ArchetypeCode,
    EventFactSetInput Facts,
    IReadOnlyList<ModuleSelectionInput> HumanSelections,
    int? BasePlanVersion = null,
    string? ActivityTypeCode = null,
    bool UseRecommendedWorkflow = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyDictionary<string, bool>? ModuleConfirmations = null,
    ActivityPlanData? ActivityPlan = null,
    int? ActivityTypeVersion = null,
    IReadOnlyList<string>? RemovedPresetKeys = null);

public sealed record EventFactSetDto(
    int? Version,
    IReadOnlyList<EventFactInputDto> Items,
    string SourceHash);

public sealed record ModuleDecisionDto(
    string ModuleCode,
    int DefinitionVersion,
    LocalizedTextDto Label,
    EventModuleDecisionStatus Status,
    IReadOnlyList<string> ReasonCodes,
    IReadOnlyList<string> Dependencies,
    IReadOnlyList<string> DataClasses,
    string IntegrationKey,
    string SurfaceKey,
    int NavigationOrder);

public sealed record RoleRequirementDto(
    string RequirementKey,
    string ModuleCode,
    string RoleCode,
    int Minimum,
    int Recommended,
    int? Maximum,
    IReadOnlyList<string> Eligibility,
    IReadOnlyList<string> SeparationFrom);

public sealed record WorkflowContributionDto(
    string ModuleCode,
    string StepKey,
    string IntegrationKey);

public sealed record ReadinessDto(
    EventReadinessStatus Status,
    IReadOnlyList<LocalizedTextDto> Blockers,
    IReadOnlyList<LocalizedTextDto> Warnings,
    DateTime CheckedUtc);

public sealed record EventWorkspaceItemDto(
    string SurfaceKey,
    string? ModuleCode,
    string Presentation,
    string? SectionKey,
    string? PathSegment,
    LocalizedTextDto Label,
    int Order,
    EventReadinessStatus Readiness,
    IReadOnlyList<LocalizedTextDto> Blockers,
    IReadOnlyList<string> AllowedActions);

public sealed record EventPlanDiffDto(
    IReadOnlyList<string> AddedModules,
    IReadOnlyList<string> RemovedModules,
    IReadOnlyList<string> ChangedModules,
    IReadOnlyList<string> BlockingRetirements);

public sealed record EventProjectModuleSourceDto(string ModuleCode, string ActivityId, IReadOnlyList<string> QuestionCodes);

public sealed record EventPlanProposalDto(
    string SchemaVersion,
    string ProposalHash,
    string BaselineETag,
    int? BasePlanVersion,
    string? ArchetypeCode,
    int? ArchetypeVersion,
    EventFactSetDto Facts,
    IReadOnlyList<ModuleDecisionDto> ModuleDecisions,
    IReadOnlyList<RoleRequirementDto> RoleRequirements,
    IReadOnlyList<WorkflowContributionDto> WorkflowContributions,
    ReadinessDto Readiness,
    IReadOnlyList<EventWorkspaceItemDto> Navigation,
    EventPlanDiffDto Diff,
    IReadOnlyList<LocalizedTextDto> Warnings,
    string? ActivityTypeCode = null,
    int? ActivityTypeVersion = null,
    EventWorkflowRecommendationDto? WorkflowRecommendation = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyDictionary<string, bool>? ModuleConfirmations = null,
    string? ActivityPlanHash = null,
    IReadOnlyList<EventProjectModuleSourceDto>? ProjectSources = null);

public sealed record EventWorkflowRecommendationDto(
    string Code,
    int? ResolvedVersion,
    LocalizedTextDto? Name,
    string Status);

public sealed record AcceptEventPlanRequest(
    string ProposalHash,
    IReadOnlyList<HumanDecisionInput> HumanDecisions,
    EventPlanComposeRequest? Composition = null,
    SavePreparationArrangementsRequest? Arrangements = null);

public sealed record EventPlanSnapshotDto(
    Guid EventId,
    int PlanVersion,
    Guid? AcceptedByMemberId,
    DateTime? AcceptedUtc,
    string ETag,
    EventPlanProposalDto Plan,
    IReadOnlyList<HumanDecisionInput> HumanDecisions);

public sealed record EventArchetypeDto(
    string Code,
    int Version,
    LocalizedTextDto Name,
    bool IsSeries,
    int OccurrenceCount,
    int? RollingOccurrenceWeeks,
    bool HasSessions,
    bool HasZones,
    IReadOnlyList<string> RequiredModules,
    IReadOnlyList<string> RecommendedModules,
    IReadOnlyList<string> ConditionalModules,
    IReadOnlyList<string> WorkflowTemplateRecommendations,
    IReadOnlyList<EventActivityTypeDto> ActivityTypes);

public sealed record EventActivityTypeDefaultsDto(
    string Visibility,
    string RegistrationMode,
    string CapacityUnit);

public sealed record EventActivityTypeServiceSlotPresetDto(
    string RoleCode,
    LocalizedTextDto Label,
    int RequiredCount,
    string EligibilityCode);

public sealed record EventTemplatePresetProjectDto(
    string PresetKey,
    LocalizedTextDto Name,
    LocalizedTextDto Conditions,
    string[] Attributes,
    IReadOnlyDictionary<string, string> DefaultAnswers,
    bool RepeatForEachOccurrence,
    ProjectConfigurationDefaultsDto? DefaultConfiguration = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string[]? EventFactSuggestions = null);

/// <summary>Optional template hints; null means the organiser must determine the fact.</summary>
public sealed record ProjectConfigurationDefaultsDto(
    LocalizedTextDto? Eligibility = null,
    int? MinimumAge = null,
    int? MaximumAge = null,
    int? Capacity = null,
    bool? AllowWaitlist = null,
    bool? RequiresGuardianConsent = null,
    long? FeeMinor = null,
    string? Currency = null,
    string? FeeChargeScope = null,
    LocalizedTextDto? Terms = null);

public sealed record EventProjectQuestionDefinitionDto(
    string Code,
    LocalizedTextDto Question,
    string[] AppliesToAttributes,
    string[] RequiredModules,
    string[] Dependencies,
    string[] UnavailableModules);

public sealed record EventActivityTypeDto(
    string Code,
    int Version,
    string ArchetypeCode,
    LocalizedTextDto Name,
    LocalizedTextDto Description,
    string IconKey,
    EventActivityTypeDefaultsDto Defaults,
    IReadOnlyList<string> PreselectedModules,
    string? RecommendedWorkflowTemplateCode,
    IReadOnlyList<EventActivityTypeServiceSlotPresetDto> PresetServiceSlots,
    IReadOnlyList<EventTemplatePresetProjectDto> PresetProjects);

public sealed record EventWorkspaceDto(
    Guid EventId,
    Guid OwningGroupId,
    LocalizedTextDto Title,
    int? PlanVersion,
    string ETag,
    ReadinessDto Readiness,
    IReadOnlyList<EventWorkspaceItemDto> Items,
    IReadOnlyList<LocalizedTextDto> NextSteps,
    bool CanManage,
    EventSponsorshipStatus SponsorshipStatus,
    IReadOnlyList<Alife.Application.Events.Services.EventCapabilityAvailabilityDto>? Capabilities = null);

public sealed record EventSeriesDto(
    Guid Id,
    Guid OwningGroupId,
    LocalizedTextDto Name,
    string RecurrenceRule,
    string TimeZone,
    IReadOnlyList<DateOnly> ExceptionDates,
    int RollingOccurrenceWeeks,
    IReadOnlyList<Guid> EventIds,
    DateTime CreatedUtc,
    DateTime UpdatedUtc,
    string ETag);

public sealed record CreateEventSeriesRequest(
    Guid EventId,
    LocalizedTextDto Name,
    string RecurrenceRule,
    string TimeZone,
    DateTime FirstStartLocal,
    int DurationMinutes,
    IReadOnlyList<DateOnly>? ExceptionDates = null,
    int RollingOccurrenceWeeks = 12);

public sealed record CreateEventSeriesSetupRequest(
    LocalizedTextDto Name,
    string RecurrenceRule,
    string TimeZone,
    DateTime FirstStartLocal,
    int DurationMinutes,
    IReadOnlyList<DateOnly>? ExceptionDates = null,
    int RollingOccurrenceWeeks = 12);

public sealed record UpdateEventSeriesRequest(
    LocalizedTextDto Name,
    string RecurrenceRule,
    string TimeZone,
    DateTime FirstStartLocal,
    int DurationMinutes,
    IReadOnlyList<DateOnly>? ExceptionDates = null,
    int RollingOccurrenceWeeks = 12);

public sealed record EventOccurrenceDto(
    Guid Id,
    Guid EventId,
    DateTime StartUtc,
    DateTime EndUtc,
    DateOnly LocalDate,
    EventOccurrenceStatus Status);

public sealed record CreateEventRoleAssignmentRequest(
    string RoleRequirementKey,
    Guid MemberId,
    string ScopeType = "event",
    Guid? ScopeId = null);

public sealed record EventRoleAssignmentDto(
    Guid Id,
    Guid EventId,
    string RoleRequirementKey,
    Guid MemberId,
    string ScopeType,
    Guid? ScopeId,
    Guid AssignedByMemberId,
    EventRoleAssignmentStatus Status,
    DateTime? AcceptedUtc,
    DateTime? DeclinedUtc,
    DateTime? EndedUtc,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);

public sealed record SponsorshipSubmissionRequest(string Reason);
public sealed record SponsorshipDecisionRequest(string Reason);

public sealed record EventSponsorshipDto(
    Guid EventId,
    EventGovernanceMode GovernanceMode,
    EventSponsorshipStatus Status,
    Guid? DecisionActorMemberId,
    string? Reason,
    DateTime? DecidedUtc,
    string ETag);
