namespace Alife.Application.Events.Dtos;

public sealed record EventSeriesInstanceDto(
    Guid EventId,
    DateOnly OccurrenceDate,
    DateTime StartUtc,
    DateTime EndUtc);

public sealed record EventSeriesDto(
    Guid Id,
    Guid GroupId,
    WorkflowTextDto Name,
    WorkflowTextDto Description,
    string TimeZoneId,
    DateOnly AnchorLocalDate,
    int StartTimeMinutes,
    int DurationMinutes,
    int IntervalWeeks,
    int GenerationHorizonWeeks,
    int LowHorizonWeeks,
    string Visibility,
    IReadOnlyList<string> DefaultModules,
    bool IsActive,
    bool NeedsGeneration,
    DateOnly? GeneratedThroughLocalDate,
    IReadOnlyList<EventSeriesInstanceDto> Instances,
    DateTime UpdatedUtc);

public sealed record EventSeriesGenerationResultDto(
    Guid SeriesId,
    int CreatedCount,
    int ExistingCount,
    DateOnly FromLocalDate,
    DateOnly ThroughLocalDate,
    IReadOnlyList<Guid> CreatedEventIds);
