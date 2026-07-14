using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Contacts.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Contacts.Commands.CreateContactProfile;

public sealed class CreateContactProfileCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService authorizationService)
    : IRequestHandler<CreateContactProfileCommand, AppResult<ContactProfileDto>>
{
    public async Task<AppResult<ContactProfileDto>> Handle(CreateContactProfileCommand request, CancellationToken cancellationToken)
    {
        if (!await authorizationService.IsLeaderOrCoLeaderAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<ContactProfileDto>.Forbidden("Only group leaders and co-leaders can create contacts.");
        }

        var memberIsApproved = await dbContext.GroupMemberships.AsNoTracking().AnyAsync(
            x => x.GroupId == request.GroupId && x.MemberId == request.MemberId && x.Status == MembershipStatus.Approved,
            cancellationToken);
        if (!memberIsApproved)
        {
            return AppResult<ContactProfileDto>.Validation("The contact must be an approved member of the owner group.");
        }

        if (await dbContext.ContactProfiles.AnyAsync(x => x.OwnerGroupId == request.GroupId && x.MemberId == request.MemberId, cancellationToken))
        {
            return AppResult<ContactProfileDto>.Conflict("This member already has a contact profile in the group.");
        }

        var name = ContactProfileMapping.NormalizeLocalized(request.Name);
        var role = ContactProfileMapping.NormalizeLocalized(request.Role);
        if (name.Count == 0 || role.Count == 0)
        {
            return AppResult<ContactProfileDto>.Validation("Name and role are required.");
        }

        if (!TryVisibility(request.Visibility, out var visibility))
        {
            return AppResult<ContactProfileDto>.Validation("Visibility must be public or groupOnly.");
        }

        var now = DateTime.UtcNow;
        var profile = new ContactProfile
        {
            Id = Guid.NewGuid(),
            MemberId = request.MemberId,
            OwnerGroupId = request.GroupId,
            NameJson = ContactProfileMapping.Serialize(name),
            RoleJson = ContactProfileMapping.Serialize(role),
            PhotoUrl = Trim(request.PhotoUrl, 1200),
            NotesJson = ContactProfileMapping.Serialize(ContactProfileMapping.NormalizeLocalized(request.Notes)),
            Phone = Trim(request.Phone, 60),
            Email = Trim(request.Email, 200),
            Visibility = visibility,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        dbContext.ContactProfiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<ContactProfileDto>.Success(ContactProfileMapping.ToDto(profile));
    }

    internal static bool TryVisibility(string value, out ContactProfileVisibility visibility)
    {
        visibility = ContactProfileVisibility.GroupOnly;
        if (string.Equals(value, "public", StringComparison.OrdinalIgnoreCase))
        {
            visibility = ContactProfileVisibility.Public;
            return true;
        }
        return string.Equals(value, "groupOnly", StringComparison.OrdinalIgnoreCase);
    }

    internal static string? Trim(string? value, int maxLength)
    {
        var result = value?.Trim();
        if (string.IsNullOrEmpty(result)) return null;
        return result.Length <= maxLength ? result : result[..maxLength];
    }
}
