using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Members.Dtos;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Queries.GetGroupInviteCandidates;

public sealed class GetGroupInviteCandidatesQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetGroupInviteCandidatesQuery, AppResult<IReadOnlyList<MemberSummaryDto>>>
{
    public async Task<AppResult<IReadOnlyList<MemberSummaryDto>>> Handle(
        GetGroupInviteCandidatesQuery request,
        CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<IReadOnlyList<MemberSummaryDto>>.Forbidden("You do not have permission to invite members.");
        }

        var group = await dbContext.Groups
            .AsNoTracking()
            .Where(x => x.Id == request.GroupId)
            .Select(x => new { x.ParentGroupId })
            .FirstOrDefaultAsync(cancellationToken);

        if (group is null)
        {
            return AppResult<IReadOnlyList<MemberSummaryDto>>.NotFound("Group was not found.");
        }

        var query = dbContext.Members.AsNoTracking().Where(x => x.IsRegistered);

        if (group.ParentGroupId is Guid parentGroupId)
        {
            query =
                from member in query
                join membership in dbContext.GroupMemberships.AsNoTracking()
                    on member.Id equals membership.MemberId
                where membership.GroupId == parentGroupId &&
                      membership.Status == MembershipStatus.Approved
                select member;
        }

        var members = await query
            .OrderBy(x => x.DisplayName)
            .Select(x => new MemberSummaryDto(x.Id, x.DisplayName))
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<MemberSummaryDto>>.Success(members);
    }
}
