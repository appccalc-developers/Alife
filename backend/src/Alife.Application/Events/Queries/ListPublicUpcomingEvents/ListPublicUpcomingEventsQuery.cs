using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.ListPublicUpcomingEvents;

public sealed record ListPublicUpcomingEventsQuery(int Limit = 50)
    : IRequest<AppResult<IReadOnlyList<PublicEventSummaryDto>>>;
