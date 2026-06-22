using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Queries.GetVisibleGroups;

public sealed record GetVisibleGroupsQuery(Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<GroupSummaryDto>>>;
