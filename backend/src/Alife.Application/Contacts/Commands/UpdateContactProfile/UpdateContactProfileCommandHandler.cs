using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Contacts.Commands.CreateContactProfile;
using Alife.Application.Contacts.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Contacts.Commands.UpdateContactProfile;

public sealed class UpdateContactProfileCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService authorizationService)
    : IRequestHandler<UpdateContactProfileCommand, AppResult<ContactProfileDto>>
{
    public async Task<AppResult<ContactProfileDto>> Handle(UpdateContactProfileCommand request, CancellationToken cancellationToken)
    {
        var profile = await dbContext.ContactProfiles.FirstOrDefaultAsync(x => x.Id == request.ContactProfileId, cancellationToken);
        if (profile is null) return AppResult<ContactProfileDto>.NotFound("Contact profile not found.");
        if (!await authorizationService.IsLeaderOrCoLeaderAsync(profile.OwnerGroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<ContactProfileDto>.Forbidden("Only group leaders and co-leaders can update contacts.");

        var approved = await dbContext.GroupMemberships.AsNoTracking().AnyAsync(
            x => x.GroupId == profile.OwnerGroupId && x.MemberId == request.MemberId && x.Status == MembershipStatus.Approved,
            cancellationToken);
        if (!approved) return AppResult<ContactProfileDto>.Validation("The contact must be an approved member of the owner group.");

        var duplicate = await dbContext.ContactProfiles.AnyAsync(
            x => x.OwnerGroupId == profile.OwnerGroupId && x.MemberId == request.MemberId && x.Id != profile.Id,
            cancellationToken);
        if (duplicate) return AppResult<ContactProfileDto>.Conflict("This member already has a contact profile in the group.");

        var name = ContactProfileMapping.NormalizeLocalized(request.Name);
        var role = ContactProfileMapping.NormalizeLocalized(request.Role);
        if (name.Count == 0 || role.Count == 0) return AppResult<ContactProfileDto>.Validation("Name and role are required.");
        if (!CreateContactProfileCommandHandler.TryVisibility(request.Visibility, out var visibility))
            return AppResult<ContactProfileDto>.Validation("Visibility must be public or groupOnly.");

        profile.MemberId = request.MemberId;
        profile.NameJson = ContactProfileMapping.Serialize(name);
        profile.RoleJson = ContactProfileMapping.Serialize(role);
        profile.PhotoUrl = CreateContactProfileCommandHandler.Trim(request.PhotoUrl, 1200);
        profile.NotesJson = ContactProfileMapping.Serialize(ContactProfileMapping.NormalizeLocalized(request.Notes));
        profile.Phone = CreateContactProfileCommandHandler.Trim(request.Phone, 60);
        profile.Email = CreateContactProfileCommandHandler.Trim(request.Email, 200);
        profile.Visibility = visibility;
        profile.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<ContactProfileDto>.Success(ContactProfileMapping.ToDto(profile));
    }
}
