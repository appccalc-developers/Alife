using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.ListEventSeries;

public sealed class ListEventSeriesQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<ListEventSeriesQuery, AppResult<IReadOnlyList<EventSeriesDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventSeriesDto>>> Handle(ListEventSeriesQuery request, CancellationToken cancellationToken)
    {
        if (!await authorization.IsLeaderOrCoLeaderAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<IReadOnlyList<EventSeriesDto>>.Forbidden("Only group leaders and co-leaders can view event series settings.");
        var series = await db.EventSeries.AsNoTracking().Include(x => x.Instances)
            .Where(x => x.GroupId == request.GroupId)
            .OrderByDescending(x => x.IsActive).ThenBy(x => x.NameEn).ThenBy(x => x.NameZh)
            .ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        return AppResult<IReadOnlyList<EventSeriesDto>>.Success(series.Select(x => EventSeriesMapper.ToDto(x, now)).ToArray());
    }
}
