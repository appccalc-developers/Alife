using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.CreateEventReview;

public sealed record CreateEventReviewCommand(
    Guid EventId,
    Guid CurrentMemberId,
    string ReviewJson,
    Guid? RequestedId)
    : IRequest<AppResult<EventReviewDto>>;
