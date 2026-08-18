using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using MediatR;

namespace Alife.Application.Events.Queries.ListPublicUpcomingEvents;

public sealed class ListPublicUpcomingEventsQueryHandler(IEventReadService eventReadService)
    : IRequestHandler<ListPublicUpcomingEventsQuery, AppResult<IReadOnlyList<PublicEventSummaryDto>>>
{
    public async Task<AppResult<IReadOnlyList<PublicEventSummaryDto>>> Handle(
        ListPublicUpcomingEventsQuery request,
        CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(request.Limit, 1, 50);
        var events = await eventReadService.GetPublicUpcomingEventsAsync(DateTime.UtcNow, limit, cancellationToken);
        return AppResult<IReadOnlyList<PublicEventSummaryDto>>.Success(events);
    }
}
