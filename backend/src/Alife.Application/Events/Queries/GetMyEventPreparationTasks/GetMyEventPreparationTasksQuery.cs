using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetMyEventPreparationTasks;

public sealed record GetMyEventPreparationTasksQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<EventPreparationTaskDto>>>;
