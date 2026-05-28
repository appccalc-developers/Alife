using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Events.Commands.DeleteEventReview;

public sealed record DeleteEventReviewCommand(
    Guid EventId,
    Guid ReviewId,
    Guid CurrentMemberId)
    : IRequest<AppResult<bool>>;
