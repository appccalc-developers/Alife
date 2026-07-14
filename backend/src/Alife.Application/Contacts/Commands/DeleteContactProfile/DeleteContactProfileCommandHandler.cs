using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Contacts.Commands.DeleteContactProfile;

public sealed class DeleteContactProfileCommandHandler(IAlifeDbContext dbContext, IGroupAuthorizationService authorizationService)
    : IRequestHandler<DeleteContactProfileCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(DeleteContactProfileCommand request, CancellationToken cancellationToken)
    {
        var profile = await dbContext.ContactProfiles.FirstOrDefaultAsync(x => x.Id == request.ContactProfileId, cancellationToken);
        if (profile is null) return AppResult<bool>.NotFound("Contact profile not found.");
        if (!await authorizationService.IsLeaderOrCoLeaderAsync(profile.OwnerGroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<bool>.Forbidden("Only group leaders and co-leaders can delete contacts.");

        profile.IsDeleted = true;
        profile.UpdatedUtc = DateTime.UtcNow;
        var eventLinks = await dbContext.EventContactProfiles
            .Where(x => x.ContactProfileId == profile.Id)
            .ToListAsync(cancellationToken);
        dbContext.EventContactProfiles.RemoveRange(eventLinks);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<bool>.Success(true);
    }
}
