using Alife.Application.Announcements.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Announcements.Queries.ListActiveAnnouncements;

public sealed class ListActiveAnnouncementsQueryHandler(IAlifeDbContext db)
    : IRequestHandler<ListActiveAnnouncementsQuery, AppResult<IReadOnlyList<AnnouncementDto>>>
{
    public async Task<AppResult<IReadOnlyList<AnnouncementDto>>> Handle(ListActiveAnnouncementsQuery request, CancellationToken cancellationToken)
    {
        var group = await db.Groups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.GroupId, cancellationToken);
        if (group is null) return AppResult<IReadOnlyList<AnnouncementDto>>.NotFound("Group not found.");

        var church = await AnnouncementAuthorization.FindChurchAsync(db, group, cancellationToken);
        var approvedGroupIds = request.CurrentMemberId.HasValue
            ? await db.GroupMemberships.AsNoTracking()
                .Where(x => x.MemberId == request.CurrentMemberId.Value && x.Status == MembershipStatus.Approved)
                .Select(x => x.GroupId)
                .ToListAsync(cancellationToken)
            : [];
        var isSpecificGroupMember = approvedGroupIds.Contains(group.Id);
        var isChurchMember = false;
        if (church is not null && approvedGroupIds.Count > 0)
        {
            var churchGroupIds = await AnnouncementAuthorization.GetChurchGroupIdsAsync(db, church.Id, cancellationToken);
            isChurchMember = approvedGroupIds.Any(churchGroupIds.Contains);
        }

        var now = DateTime.UtcNow;
        var churchId = church?.Id;
        var announcements = await db.Announcements.AsNoTracking()
            .Where(x => x.Status == AnnouncementStatus.Published && x.PublishUtc <= now && (!x.ExpireUtc.HasValue || x.ExpireUtc > now))
            .Where(x =>
                (x.GroupId == group.Id && x.Audience == AnnouncementAudience.SpecificGroup && isSpecificGroupMember) ||
                (churchId.HasValue && x.GroupId == churchId.Value && x.Audience == AnnouncementAudience.Public) ||
                (churchId.HasValue && x.GroupId == churchId.Value && x.Audience == AnnouncementAudience.ChurchMembers && isChurchMember))
            .OrderByDescending(x => x.IsPinned)
            .ThenByDescending(x => x.Priority)
            .ThenByDescending(x => x.PublishUtc)
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<AnnouncementDto>>.Success(announcements.Select(AnnouncementMapper.ToDto).ToList());
    }
}
