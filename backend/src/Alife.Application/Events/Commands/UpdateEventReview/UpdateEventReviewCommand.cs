using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventReview;

public sealed record UpdateEventReviewCommand(
    Guid EventId,
    Guid ReviewId,
    Guid CurrentMemberId,
    string ReviewJson)
    : IRequest<AppResult<EventReviewDto>>;
