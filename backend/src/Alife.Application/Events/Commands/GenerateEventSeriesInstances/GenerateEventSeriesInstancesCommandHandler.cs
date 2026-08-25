using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.GenerateEventSeriesInstances;

public sealed class GenerateEventSeriesInstancesCommandHandler(
    IAlifeDbContext db,
    IGroupAuthorizationService authorization,
    IEventCacheInvalidationService cacheInvalidation)
    : IRequestHandler<GenerateEventSeriesInstancesCommand, AppResult<EventSeriesGenerationResultDto>>
{
    public async Task<AppResult<EventSeriesGenerationResultDto>> Handle(GenerateEventSeriesInstancesCommand request, CancellationToken cancellationToken)
    {
        var series = await db.EventSeries.Include(x => x.Instances)
            .FirstOrDefaultAsync(x => x.Id == request.SeriesId, cancellationToken);
        if (series is null) return AppResult<EventSeriesGenerationResultDto>.NotFound("Event series not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(series.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventSeriesGenerationResultDto>.Forbidden("Only group leaders and co-leaders can generate event instances.");
        if (!series.IsActive) return AppResult<EventSeriesGenerationResultDto>.Validation("Activate the series before generating events.");
        var horizon = request.HorizonWeeks ?? series.GenerationHorizonWeeks;
        if (horizon is < 1 or > 52) return AppResult<EventSeriesGenerationResultDto>.Validation("Generation horizon must be between 1 and 52 weeks.");
        var now = DateTime.UtcNow;
        var from = request.FromLocalDate ?? EventSeriesPolicy.LocalToday(series, now);
        var dates = EventSeriesPolicy.OccurrenceDates(series, from, horizon);
        var existingDates = series.Instances.Where(x => !x.IsDeleted && x.SeriesOccurrenceDate.HasValue)
            .Select(x => x.SeriesOccurrenceDate!.Value).ToHashSet();
        var createdIds = new List<Guid>();
        foreach (var date in dates.Where(x => !existingDates.Contains(x)))
        {
            if (!EventSeriesPolicy.TryCreateUtcRange(series, date, out var startUtc, out var endUtc))
                return AppResult<EventSeriesGenerationResultDto>.Validation($"The local start time is invalid on {date:yyyy-MM-dd} in {series.TimeZoneId}.");
            var eventDataJson = EventSeriesPolicy.CreateEventDataJson(series, date);
            var ram = new EventRamAssessment
            {
                EventId = Guid.Empty, RamDataJson = "{}", Status = EventRamStatus.Draft,
                CreatedUtc = now, UpdatedUtc = now
            };
            var groupEvent = new GroupEvent
            {
                Id = Guid.NewGuid(), GroupId = series.GroupId, CreatedByMemberId = request.CurrentMemberId,
                EventSeriesId = series.Id, SeriesOccurrenceDate = date,
                TitleEn = series.NameEn, TitleZh = series.NameZh, StartDate = startUtc, EndDate = endUtc,
                EventDataJson = eventDataJson, CreatedUtc = now, UpdatedUtc = now,
                RamAssessment = ram, EventSeries = series
            };
            ram.EventId = groupEvent.Id;
            groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, request.CurrentMemberId, ram.RamDataJson, now);
            db.GroupEvents.Add(groupEvent);
            db.EventRamAssessments.Add(ram);
            createdIds.Add(groupEvent.Id);
        }
        series.UpdatedUtc = now;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, GroupId = series.GroupId,
            Action = "event-series.instances-generated", EntityType = nameof(EventSeries), EntityId = series.Id,
            AfterJson = JsonSerializer.Serialize(new { from, horizon, createdCount = createdIds.Count, existingCount = dates.Count - createdIds.Count }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        await cacheInvalidation.RemoveGroupEventsAsync(series.GroupId, cancellationToken);
        var through = dates.LastOrDefault();
        if (through == default) through = from.AddDays(horizon * 7 - 1);
        return AppResult<EventSeriesGenerationResultDto>.Success(new EventSeriesGenerationResultDto(
            series.Id, createdIds.Count, dates.Count - createdIds.Count, from, through, createdIds));
    }
}
