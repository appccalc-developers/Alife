using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Queries.GetGroupMemberships;

public sealed record GetGroupMembershipsQuery(Guid GroupId, Guid CurrentMemberId, bool IncludeChurchLineCandidates = false)
    : IRequest<AppResult<IReadOnlyList<GroupMembershipDto>>>;
