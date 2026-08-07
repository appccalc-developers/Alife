using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventWorkflow;

public sealed record GetEventWorkflowQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventWorkflowDto?>>;
