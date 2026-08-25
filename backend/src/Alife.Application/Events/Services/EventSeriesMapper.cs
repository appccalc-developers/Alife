using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public static class EventSeriesMapper
{
    public static EventSeriesDto ToDto(EventSeries series, DateTime utcNow)
    {
        var instances = series.Instances
            .Where(x => !x.IsDeleted && x.SeriesOccurrenceDate.HasValue)
            .OrderBy(x => x.SeriesOccurrenceDate)
            .Select(x => new EventSeriesInstanceDto(x.Id, x.SeriesOccurrenceDate!.Value, x.StartDate, x.EndDate))
            .ToArray();
        var generatedThrough = instances.LastOrDefault()?.OccurrenceDate;
        var localToday = EventSeriesPolicy.LocalToday(series, utcNow);
        var warningDate = localToday.AddDays(series.LowHorizonWeeks * 7);
        return new EventSeriesDto(
            series.Id, series.GroupId,
            new WorkflowTextDto(series.NameEn, series.NameZh),
            new WorkflowTextDto(series.DescriptionEn, series.DescriptionZh),
            series.TimeZoneId, series.AnchorLocalDate, series.StartTimeMinutes, series.DurationMinutes,
            series.IntervalWeeks, series.GenerationHorizonWeeks, series.LowHorizonWeeks, series.Visibility,
            EventSeriesPolicy.ReadModules(series.DefaultModulesJson), series.IsActive,
            series.IsActive && (!generatedThrough.HasValue || generatedThrough.Value < warningDate),
            generatedThrough, instances, series.UpdatedUtc);
    }
}
