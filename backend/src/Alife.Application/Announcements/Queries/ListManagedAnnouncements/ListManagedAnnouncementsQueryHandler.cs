using Alife.Application.Announcements.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Announcements.Queries.ListManagedAnnouncements;

public sealed class ListManagedAnnouncementsQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<ListManagedAnnouncementsQuery, AppResult<IReadOnlyList<AnnouncementDto>>>
{
    public async Task<AppResult<IReadOnlyList<AnnouncementDto>>> Handle(ListManagedAnnouncementsQuery request, CancellationToken cancellationToken)
    {
        if (!await authorization.IsLeaderOrCoLeaderAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<IReadOnlyList<AnnouncementDto>>.Forbidden("Only group leaders and co-leaders can manage announcements.");

        var values = await db.Announcements.AsNoTracking()
            .Where(x => x.GroupId == request.GroupId)
            .OrderByDescending(x => x.IsPinned).ThenByDescending(x => x.PublishUtc)
            .ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<AnnouncementDto>>.Success(values.Select(AnnouncementMapper.ToDto).ToList());
    }
}
