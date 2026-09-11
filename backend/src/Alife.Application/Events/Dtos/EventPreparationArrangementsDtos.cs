namespace Alife.Application.Events.Dtos;

public sealed record PreparationSlotRow(Guid? Id, EventCreationSlotRequest Details);
public sealed record PreparationSessionRow(Guid? Id, EventCreationSessionRequest Details, IReadOnlyList<Guid?> ItemIds);
public sealed record PreparationVenueRow(Guid? Id, EventCreationVenueRequest Details, SaveEventVenueRequest? Venue = null);
public sealed record PreparationSeriesUpdate(string ETag, UpdateEventSeriesRequest Details);
public sealed record SavePreparationArrangementsRequest(Guid OccurrenceId, string ETag,
    IReadOnlyList<PreparationSlotRow>? ServiceSlots = null,
    IReadOnlyList<PreparationSessionRow>? Sessions = null,
    IReadOnlyList<PreparationVenueRow>? VenueBookings = null);
public sealed record PreparationArrangementsDto(Guid OccurrenceId, DateTime StartUtc, DateTime EndUtc,
    string ETag, IReadOnlyList<PreparationSlotRow> ServiceSlots,
    IReadOnlyList<PreparationSessionRow> Sessions, IReadOnlyList<PreparationVenueRow> VenueBookings,
    EventSeriesDto? Series = null);
