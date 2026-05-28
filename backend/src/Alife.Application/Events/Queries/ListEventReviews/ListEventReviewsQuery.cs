using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.ListEventReviews;

public sealed record ListEventReviewsQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<EventReviewDto>>>;
