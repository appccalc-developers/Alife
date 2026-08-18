namespace Alife.Application.Events.Dtos;

public sealed record PublicEventSummaryDto(
    Guid Id,
    Guid GroupId,
    string TitleEn,
    string TitleZh,
    DateTime StartDate,
    DateTime EndDate,
    string EventDataJson,
    string Visibility);
