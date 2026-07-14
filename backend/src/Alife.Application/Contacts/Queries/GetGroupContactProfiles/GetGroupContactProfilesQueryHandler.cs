using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Contacts.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Contacts.Queries.GetGroupContactProfiles;

public sealed class GetGroupContactProfilesQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService authorizationService)
    : IRequestHandler<GetGroupContactProfilesQuery, AppResult<IReadOnlyList<ContactProfileDto>>>
{
    public async Task<AppResult<IReadOnlyList<ContactProfileDto>>> Handle(
        GetGroupContactProfilesQuery request,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.Groups.AsNoTracking().AnyAsync(x => x.Id == request.GroupId, cancellationToken))
        {
            return AppResult<IReadOnlyList<ContactProfileDto>>.NotFound("Group not found.");
        }

        var canViewGroupOnly = request.CurrentMemberId is Guid memberId &&
            await authorizationService.IsApprovedMemberAsync(request.GroupId, memberId, cancellationToken);

        var query = dbContext.ContactProfiles
            .AsNoTracking()
            .Where(x => x.OwnerGroupId == request.GroupId);

        if (!canViewGroupOnly)
        {
            query = query.Where(x => x.Visibility == ContactProfileVisibility.Public);
        }

        var profiles = await query.OrderBy(x => x.CreatedUtc).ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<ContactProfileDto>>.Success(profiles.Select(ContactProfileMapping.ToDto).ToArray());
    }
}
