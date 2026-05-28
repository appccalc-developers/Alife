using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.ListEventEnrollments;

public sealed record ListEventEnrollmentsQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<EventEnrollmentDto>>>;
