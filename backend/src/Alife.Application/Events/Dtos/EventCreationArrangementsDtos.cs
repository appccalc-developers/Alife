namespace Alife.Application.Events.Dtos;

// Optional creation-only input; operational details remain in protected module tables.
public sealed record EventCreationArrangementsRequest(
    IReadOnlyList<EventCreationSlotRequest>? ServiceSlots = null,
    IReadOnlyList<EventCreationSessionRequest>? Sessions = null,
    IReadOnlyList<EventCreationVenueRequest>? VenueBookings = null);
public sealed record EventCreationSlotRequest(string RoleCode, int RequiredCount, string EligibilityCode,
    int StartOffsetMinutes, int EndOffsetMinutes);
public sealed record EventCreationSessionRequest(LocalizedTextDto Title, int StartOffsetMinutes,
    int EndOffsetMinutes, IReadOnlyList<EventCreationProgramItemRequest> Items);
public sealed record EventCreationProgramItemRequest(LocalizedTextDto Title, LocalizedTextDto? Description,
    int StartOffsetMinutes, int DurationMinutes);
public sealed record EventCreationVenueRequest(Guid? VenueId, string? VenueETag,
    SaveEventVenueRequest? NewVenue, int RequiredCapacity, int StartOffsetMinutes, int EndOffsetMinutes);
