using Alife.Application.Common.Models;
using Alife.Application.VisitContactRequests.Dtos;
using MediatR;

namespace Alife.Application.VisitContactRequests.Commands.UpdateVisitContactRequestStatus;

public sealed record UpdateVisitContactRequestStatusCommand(
    Guid CurrentMemberId,
    Guid RequestId,
    string Status)
    : IRequest<AppResult<VisitContactRequestDto>>;
