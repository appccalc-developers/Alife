using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Capabilities;

public sealed class ListRosterCapabilitiesQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<ListRosterCapabilitiesQuery, AppResult<IReadOnlyList<RosterCapabilityDto>>>
{
    public async Task<AppResult<IReadOnlyList<RosterCapabilityDto>>> Handle(
        ListRosterCapabilitiesQuery request, CancellationToken cancellationToken)
    {
        if (!await authorization.IsLeaderOrCoLeaderAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<IReadOnlyList<RosterCapabilityDto>>.Forbidden("Only group leaders can maintain roster capabilities.");
        var capabilities = await db.GroupRosterCapabilities.AsNoTracking()
            .Where(x => x.GroupId == request.GroupId)
            .OrderByDescending(x => x.IsActive).ThenBy(x => x.NameEn).ThenBy(x => x.Key)
            .Select(x => new RosterCapabilityDto(
                x.Id, x.GroupId, x.Key, new WorkflowTextDto(x.NameEn, x.NameZh),
                new WorkflowTextDto(x.DescriptionEn, x.DescriptionZh), x.RequiresExpiry,
                x.DefaultValidityDays, x.IsActive, x.UpdatedUtc))
            .ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<RosterCapabilityDto>>.Success(capabilities);
    }
}
