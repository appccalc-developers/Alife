using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetGroupEvents;

public sealed record GetGroupEventsQuery(
    Guid GroupId,
    Guid CurrentMemberId) : IRequest<AppResult<IReadOnlyList<GroupEventSummaryDto>>>;
