using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.SaveEventSeries;

public sealed class SaveEventSeriesCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveEventSeriesCommand, AppResult<EventSeriesDto>>
{
    public async Task<AppResult<EventSeriesDto>> Handle(SaveEventSeriesCommand request, CancellationToken cancellationToken)
    {
        if (!await authorization.IsLeaderOrCoLeaderAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventSeriesDto>.Forbidden("Only group leaders and co-leaders can manage event series.");
        var modules = EventSeriesPolicy.NormalizeModules(request.DefaultModules);
        var error = EventSeriesPolicy.ValidationError(
            request.NameEn, request.NameZh, request.DescriptionEn, request.DescriptionZh,
            request.TimeZoneId, request.AnchorLocalDate, request.StartTimeMinutes, request.DurationMinutes,
            request.IntervalWeeks, request.GenerationHorizonWeeks, request.LowHorizonWeeks,
            request.Visibility, request.DefaultModules);
        if (error is not null) return AppResult<EventSeriesDto>.Validation(error);

        EventSeries? series = null;
        if (request.SeriesId is Guid seriesId)
        {
            series = await db.EventSeries.Include(x => x.Instances)
                .FirstOrDefaultAsync(x => x.Id == seriesId && x.GroupId == request.GroupId, cancellationToken);
            if (series is null) return AppResult<EventSeriesDto>.NotFound("Event series not found.");
        }
        var now = DateTime.UtcNow;
        if (series is null)
        {
            series = new EventSeries
            {
                Id = Guid.NewGuid(), GroupId = request.GroupId, CreatedByMemberId = request.CurrentMemberId,
                CreatedUtc = now
            };
            db.EventSeries.Add(series);
        }
        series.NameEn = Fallback(request.NameEn, request.NameZh);
        series.NameZh = Fallback(request.NameZh, request.NameEn);
        series.DescriptionEn = Fallback(request.DescriptionEn, request.DescriptionZh);
        series.DescriptionZh = Fallback(request.DescriptionZh, request.DescriptionEn);
        series.TimeZoneId = request.TimeZoneId.Trim();
        series.AnchorLocalDate = request.AnchorLocalDate;
        series.Weekday = request.AnchorLocalDate.DayOfWeek;
        series.StartTimeMinutes = request.StartTimeMinutes;
        series.DurationMinutes = request.DurationMinutes;
        series.IntervalWeeks = request.IntervalWeeks;
        series.GenerationHorizonWeeks = request.GenerationHorizonWeeks;
        series.LowHorizonWeeks = request.LowHorizonWeeks;
        series.Visibility = request.Visibility;
        series.DefaultModulesJson = EventSeriesPolicy.SerializeModules(modules);
        series.IsActive = request.IsActive;
        series.UpdatedUtc = now;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, GroupId = request.GroupId,
            Action = request.SeriesId.HasValue ? "event-series.updated" : "event-series.created",
            EntityType = nameof(EventSeries), EntityId = series.Id,
            AfterJson = JsonSerializer.Serialize(new { series.IsActive, series.AnchorLocalDate, series.IntervalWeeks, modules }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EventSeriesDto>.Success(EventSeriesMapper.ToDto(series, now));
    }

    private static string Fallback(string preferred, string fallback)
        => string.IsNullOrWhiteSpace(preferred) ? fallback.Trim() : preferred.Trim();
}
