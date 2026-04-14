using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Queries.GetSubgroups;

public sealed record GetSubgroupsQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<GroupSummaryDto>>>;
