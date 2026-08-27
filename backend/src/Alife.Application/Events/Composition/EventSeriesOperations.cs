using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Composition;

public sealed record ListEventSeriesQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<EventSeriesDto>>>;

public sealed class ListEventSeriesQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<ListEventSeriesQuery, AppResult<IReadOnlyList<EventSeriesDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventSeriesDto>>> Handle(
        ListEventSeriesQuery request,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorizationService.IsApprovedMemberAsync(
                request.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<IReadOnlyList<EventSeriesDto>>.Forbidden(
                "Approved group membership is required to view event series.");
        }
        var series = await dbContext.EventSeries.AsNoTracking()
            .Include(x => x.Events)
            .Where(x => x.OwningGroupId == request.GroupId)
            .OrderBy(x => x.NameEn)
            .ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<EventSeriesDto>>.Success(series.Select(ToDto).ToArray());
    }

    internal static EventSeriesDto ToDto(EventSeries series)
    {
        IReadOnlyList<DateOnly> exceptionDates;
        try
        {
            exceptionDates = JsonSerializer.Deserialize<DateOnly[]>(series.ExceptionDatesJson) ?? [];
        }
        catch (JsonException)
        {
            exceptionDates = [];
        }
        return new EventSeriesDto(
            series.Id,
            series.OwningGroupId,
            new LocalizedTextDto(series.NameEn, series.NameZh),
            series.RecurrenceRule,
            series.TimeZone,
            exceptionDates,
            series.RollingOccurrenceWeeks,
            series.Events.Select(x => x.Id).OrderBy(x => x).ToArray(),
            series.CreatedUtc,
            series.UpdatedUtc,
            CreateETag(series));
    }

    internal static string CreateETag(EventSeries series)
        => $"\"series-{series.Id:N}-{series.UpdatedUtc.Ticks:x}\"";
}

public sealed record GetEventSeriesQuery(Guid SeriesId, Guid CurrentMemberId)
    : IRequest<AppResult<EventSeriesDto>>;

public sealed class GetEventSeriesQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetEventSeriesQuery, AppResult<EventSeriesDto>>
{
    public async Task<AppResult<EventSeriesDto>> Handle(
        GetEventSeriesQuery request,
        CancellationToken cancellationToken)
    {
        var series = await dbContext.EventSeries.AsNoTracking()
            .Include(x => x.Events)
            .FirstOrDefaultAsync(x => x.Id == request.SeriesId, cancellationToken);
        if (series is null)
        {
            return AppResult<EventSeriesDto>.NotFound("Event series not found.");
        }
        if (!await groupAuthorizationService.IsApprovedMemberAsync(
                series.OwningGroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventSeriesDto>.Forbidden(
                "Approved group membership is required to view the event series.");
        }
        return AppResult<EventSeriesDto>.Success(ListEventSeriesQueryHandler.ToDto(series));
    }
}

public sealed record CreateEventSeriesCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    CreateEventSeriesRequest Request,
    string? IdempotencyKey)
    : IRequest<AppResult<EventSeriesDto>>;

public sealed class CreateEventSeriesCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<CreateEventSeriesCommand, AppResult<EventSeriesDto>>
{
    public async Task<AppResult<EventSeriesDto>> Handle(
        CreateEventSeriesCommand request,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventSeriesDto>.Forbidden(
                "Only owning-group leaders and co-leaders can create event series.");
        }
        var key = request.IdempotencyKey?.Trim();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 200)
        {
            return AppResult<EventSeriesDto>.Validation("A valid Idempotency-Key header is required.");
        }
        var requestHash = EventCompositionEngine.Hash(request.Request);
        var retry = await dbContext.EventIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Operation == "event.series.create" &&
                x.ScopeId == request.GroupId && x.Key == key, cancellationToken);
        if (retry is not null)
        {
            if (!string.Equals(retry.RequestHash, requestHash, StringComparison.Ordinal))
            {
                return AppResult<EventSeriesDto>.Conflict(
                    "The Idempotency-Key was already used with a different request.");
            }
            var existing = await dbContext.EventSeries.AsNoTracking()
                .Include(x => x.Events)
                .FirstOrDefaultAsync(x => x.Id == retry.ResultEntityId, cancellationToken);
            return existing is null
                ? AppResult<EventSeriesDto>.Conflict("The idempotent result is no longer available.")
                : AppResult<EventSeriesDto>.Success(ListEventSeriesQueryHandler.ToDto(existing));
        }

        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.Occurrences)
            .FirstOrDefaultAsync(x => x.Id == request.Request.EventId, cancellationToken);
        if (groupEvent is null || groupEvent.GroupId != request.GroupId)
        {
            return AppResult<EventSeriesDto>.NotFound("Event not found in the owning group.");
        }
        if (groupEvent.EventSeriesId.HasValue)
        {
            return AppResult<EventSeriesDto>.Conflict("The event already belongs to an event series.");
        }
        if (!TryValidate(request.Request, out var interval, out var zone, out var error))
        {
            return AppResult<EventSeriesDto>.Validation(error!);
        }

        var now = DateTime.UtcNow;
        var series = new EventSeries
        {
            Id = Guid.NewGuid(),
            OwningGroupId = request.GroupId,
            CreatedByMemberId = request.CurrentMemberId,
            NameEn = request.Request.Name.En.Trim(),
            NameZh = request.Request.Name.Zh.Trim(),
            RecurrenceRule = request.Request.RecurrenceRule.Trim().ToUpperInvariant(),
            TimeZone = request.Request.TimeZone.Trim(),
            ExceptionDatesJson = JsonSerializer.Serialize(request.Request.ExceptionDates ?? []),
            RollingOccurrenceWeeks = request.Request.RollingOccurrenceWeeks,
            CreatedUtc = now,
            UpdatedUtc = now,
            Events = [groupEvent]
        };
        groupEvent.EventSeriesId = series.Id;
        groupEvent.UpdatedUtc = now;
        var exceptions = (request.Request.ExceptionDates ?? []).ToHashSet();
        var starts = groupEvent.Occurrences.Select(x => x.StartUtc).ToHashSet();
        var occurrences = EventSeriesMaterializer.Materialize(
            groupEvent.Id,
            request.Request.FirstStartLocal,
            request.Request.DurationMinutes,
            interval,
            request.Request.RollingOccurrenceWeeks,
            zone!,
            exceptions,
            starts,
            now);
        dbContext.EventSeries.Add(series);
        dbContext.EventOccurrences.AddRange(occurrences);
        dbContext.EventIdempotencyRecords.Add(new EventIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            Operation = "event.series.create",
            ScopeId = request.GroupId,
            Key = key,
            RequestHash = requestHash,
            ResultEntityId = series.Id,
            CreatedUtc = now,
            ExpiresUtc = now.AddDays(7)
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventSeriesDto>.Success(ListEventSeriesQueryHandler.ToDto(series));
    }

    private static bool TryValidate(
        CreateEventSeriesRequest request,
        out int interval,
        out TimeZoneInfo? zone,
        out string? error)
    {
        if (string.IsNullOrWhiteSpace(request.Name.En) || string.IsNullOrWhiteSpace(request.Name.Zh))
        {
            interval = 0;
            zone = null;
            error = "Both English and Chinese series names are required.";
            return false;
        }
        return EventSeriesMaterializer.TryValidate(
            request.RecurrenceRule, request.TimeZone, request.FirstStartLocal,
            request.DurationMinutes, request.RollingOccurrenceWeeks,
            out interval, out zone, out error);
    }
}

public sealed record UpdateEventSeriesCommand(
    Guid SeriesId,
    Guid CurrentMemberId,
    UpdateEventSeriesRequest Request,
    string? IfMatch)
    : IRequest<AppResult<EventSeriesDto>>;

public sealed class UpdateEventSeriesCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<UpdateEventSeriesCommand, AppResult<EventSeriesDto>>
{
    public async Task<AppResult<EventSeriesDto>> Handle(
        UpdateEventSeriesCommand request,
        CancellationToken cancellationToken)
    {
        var series = await dbContext.EventSeries
            .Include(x => x.Events)
                .ThenInclude(x => x.Occurrences)
            .FirstOrDefaultAsync(x => x.Id == request.SeriesId, cancellationToken);
        if (series is null)
        {
            return AppResult<EventSeriesDto>.NotFound("Event series not found.");
        }
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                series.OwningGroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventSeriesDto>.Forbidden(
                "Only owning-group leaders and co-leaders can update event series.");
        }
        if (string.IsNullOrWhiteSpace(request.IfMatch) ||
            !string.Equals(request.IfMatch.Trim(), ListEventSeriesQueryHandler.CreateETag(series), StringComparison.Ordinal))
        {
            return AppResult<EventSeriesDto>.PreconditionFailed(
                "The event series changed. Refresh before updating it.");
        }
        var createShape = new CreateEventSeriesRequest(
            series.Events.FirstOrDefault()?.Id ?? Guid.Empty,
            request.Request.Name,
            request.Request.RecurrenceRule,
            request.Request.TimeZone,
            request.Request.FirstStartLocal,
            request.Request.DurationMinutes,
            request.Request.ExceptionDates,
            request.Request.RollingOccurrenceWeeks);
        if (string.IsNullOrWhiteSpace(createShape.Name.En) || string.IsNullOrWhiteSpace(createShape.Name.Zh))
        {
            return AppResult<EventSeriesDto>.Validation("Both English and Chinese series names are required.");
        }
        if (!EventSeriesMaterializer.TryValidate(
                createShape.RecurrenceRule, createShape.TimeZone, createShape.FirstStartLocal,
                createShape.DurationMinutes, createShape.RollingOccurrenceWeeks,
                out var interval, out var zone, out var error))
        {
            return AppResult<EventSeriesDto>.Validation(error!);
        }

        var now = DateTime.UtcNow;
        series.NameEn = request.Request.Name.En.Trim();
        series.NameZh = request.Request.Name.Zh.Trim();
        series.RecurrenceRule = request.Request.RecurrenceRule.Trim().ToUpperInvariant();
        series.TimeZone = request.Request.TimeZone.Trim();
        series.ExceptionDatesJson = JsonSerializer.Serialize(request.Request.ExceptionDates ?? []);
        series.RollingOccurrenceWeeks = request.Request.RollingOccurrenceWeeks;
        series.UpdatedUtc = now;
        var exceptions = (request.Request.ExceptionDates ?? []).ToHashSet();
        foreach (var groupEvent in series.Events)
        {
            var starts = groupEvent.Occurrences.Select(x => x.StartUtc).ToHashSet();
            dbContext.EventOccurrences.AddRange(EventSeriesMaterializer.Materialize(
                groupEvent.Id,
                request.Request.FirstStartLocal,
                request.Request.DurationMinutes,
                interval,
                request.Request.RollingOccurrenceWeeks,
                zone!,
                exceptions,
                starts,
                now));
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventSeriesDto>.Success(ListEventSeriesQueryHandler.ToDto(series));
    }
}

public sealed record ListEventSeriesOccurrencesQuery(
    Guid SeriesId,
    Guid CurrentMemberId,
    DateOnly? From,
    DateOnly? To)
    : IRequest<AppResult<IReadOnlyList<EventOccurrenceDto>>>;

public sealed class ListEventSeriesOccurrencesQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<ListEventSeriesOccurrencesQuery, AppResult<IReadOnlyList<EventOccurrenceDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventOccurrenceDto>>> Handle(
        ListEventSeriesOccurrencesQuery request,
        CancellationToken cancellationToken)
    {
        var series = await dbContext.EventSeries.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.SeriesId, cancellationToken);
        if (series is null)
        {
            return AppResult<IReadOnlyList<EventOccurrenceDto>>.NotFound("Event series not found.");
        }
        if (!await groupAuthorizationService.IsApprovedMemberAsync(
                series.OwningGroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<IReadOnlyList<EventOccurrenceDto>>.Forbidden(
                "Approved group membership is required to view occurrences.");
        }
        if (request.From.HasValue && request.To.HasValue && request.From > request.To)
        {
            return AppResult<IReadOnlyList<EventOccurrenceDto>>.Validation("from must be on or before to.");
        }

        var query = dbContext.EventOccurrences.AsNoTracking()
            .Where(x => x.Event.EventSeriesId == series.Id);
        if (request.From.HasValue)
        {
            query = query.Where(x => x.LocalDate >= request.From.Value);
        }
        if (request.To.HasValue)
        {
            query = query.Where(x => x.LocalDate <= request.To.Value);
        }
        var occurrences = await query.OrderBy(x => x.StartUtc).ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<EventOccurrenceDto>>.Success(occurrences.Select(x => new EventOccurrenceDto(
            x.Id, x.EventId, x.StartUtc, x.EndUtc, x.LocalDate, x.Status, x.IsLegacyBackfill)).ToArray());
    }
}
