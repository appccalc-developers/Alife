using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.SaveEventSeries;

public sealed record SaveEventSeriesCommand(
    Guid? SeriesId,
    Guid GroupId,
    Guid CurrentMemberId,
    string NameEn,
    string NameZh,
    string DescriptionEn,
    string DescriptionZh,
    string TimeZoneId,
    DateOnly AnchorLocalDate,
    int StartTimeMinutes,
    int DurationMinutes,
    int IntervalWeeks,
    int GenerationHorizonWeeks,
    int LowHorizonWeeks,
    string Visibility,
    IReadOnlyList<string> DefaultModules,
    bool IsActive) : IRequest<AppResult<EventSeriesDto>>;
