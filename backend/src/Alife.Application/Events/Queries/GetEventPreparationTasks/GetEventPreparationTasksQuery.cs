using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventPreparationTasks;

public sealed record GetEventPreparationTasksQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventPreparationTaskWorkspaceDto>>;
