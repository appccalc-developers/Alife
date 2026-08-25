using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventPlan;

public sealed record GetEventPlanQuery(Guid EventId, Guid CurrentMemberId) : IRequest<AppResult<EventPlanDto>>;
