using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.DeleteGroupEvent;

public sealed record DeleteGroupEventCommand(
    Guid EventId,
    Guid CurrentMemberId) : IRequest<AppResult<bool>>;
