using Alife.Application.Common;
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

        var memberRows = await query
            .OrderBy(x => x.DisplayName)
            .Select(x => new { x.Id, x.DisplayName })
            .ToListAsync(cancellationToken);

        var memberIds = memberRows.Select(x => x.Id).ToHashSet();
        var membershipRows = await dbContext.GroupMemberships
            .AsNoTracking()
            .Where(x => x.GroupId == request.GroupId && memberIds.Contains(x.MemberId))
            .OrderByDescending(x => x.UpdatedUtc)
            .Select(x => new { x.MemberId, x.Status })
            .ToListAsync(cancellationToken);

        var membershipStatuses = membershipRows
            .GroupBy(x => x.MemberId)
            .ToDictionary(x => x.Key, x => EnumName.CamelCase(x.First().Status));

        var members = memberRows
            .Select(x => new MemberSummaryDto(
                x.Id,
                x.DisplayName,
                membershipStatuses.GetValueOrDefault(x.Id)))
            .ToList();

        return AppResult<IReadOnlyList<MemberSummaryDto>>.Success(members);
    }
}
