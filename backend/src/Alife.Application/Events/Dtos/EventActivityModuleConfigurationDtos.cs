namespace Alife.Application.Events.Dtos;

public sealed record ProjectMealConfiguration(LocalizedTextDto ServiceMethod, LocalizedTextDto PreparationPlace,
    LocalizedTextDto DietaryHandling, LocalizedTextDto FoodSafetyPlan);
public sealed record ProjectTravelConfiguration(LocalizedTextDto Origin, LocalizedTextDto Destination,
    LocalizedTextDto Timetable, Guid? JourneyId);
public sealed record ProjectStayConfiguration(LocalizedTextDto Site, DateTime? CheckInUtc, DateTime? CheckOutUtc,
    LocalizedTextDto RoomingPlan);
public sealed record ProjectProgrammeConfiguration(IReadOnlyList<Guid> ProgramItemIds, LocalizedTextDto ProductionNotes);
public sealed record ProjectRosterConfiguration(IReadOnlyList<Guid> ServiceSlotIds, LocalizedTextDto StaffingNotes);

/// <summary>Exactly one typed detail must be supplied for the requested kind.</summary>
public sealed record SaveProjectModuleConfigurationRequest(Guid? OccurrenceId,
    ProjectMealConfiguration? Meal = null, ProjectTravelConfiguration? Travel = null,
    ProjectStayConfiguration? Stay = null, ProjectProgrammeConfiguration? Programme = null,
    ProjectRosterConfiguration? Roster = null);
public sealed record ProjectModuleConfigurationDto(Guid Id, string ActivityId, Guid? OccurrenceId,
    string Kind, SaveProjectModuleConfigurationRequest Details, string ETag, DateTime UpdatedUtc);
public sealed record ProjectModuleConfigurationWorkspaceDto(IReadOnlyList<ProjectModuleConfigurationDto> Items,
    IReadOnlyList<string> CanEditKinds);
