using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Groups.Queries.GetGroupInviteCandidates;

public sealed record GetGroupInviteCandidatesQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<MemberSummaryDto>>>;
