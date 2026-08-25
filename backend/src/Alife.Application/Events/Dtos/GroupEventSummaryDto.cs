using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

/// <summary>Summary of a persisted group event (used in list views).</summary>
public record GroupEventSummaryDto(
    Guid Id,
    Guid GroupId,
    Guid CreatedByMemberId,
    string TitleEn,
    string TitleZh,
    DateTime StartDate,
    DateTime EndDate,
    string EventDataJson,
    DateTime CreatedUtc,
    DateTime UpdatedUtc,
    IReadOnlyList<Guid>? ContactProfileIds = null,
    EventRamStatus RamStatus = EventRamStatus.Draft,
    string Visibility = "groupVisible",
    bool RequiresRam = false,
    Guid? EventSeriesId = null,
    DateOnly? SeriesOccurrenceDate = null,
    IReadOnlyList<string>? EnabledModules = null);
