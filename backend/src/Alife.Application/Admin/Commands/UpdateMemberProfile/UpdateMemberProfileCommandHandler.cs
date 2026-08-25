using System.Text.Json;
using System.Text.RegularExpressions;
using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Commands.UpdateMemberProfile;

public sealed partial class UpdateMemberProfileCommandHandler(
    IAlifeDbContext dbContext,
    IGroupCacheInvalidationService groupCacheInvalidationService)
    : IRequestHandler<UpdateMemberProfileCommand, AppResult<AdminMemberDto>>
{
    public async Task<AppResult<AdminMemberDto>> Handle(
        UpdateMemberProfileCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ManageMemberProfiles,
                cancellationToken))
        {
            return AppResult<AdminMemberDto>.Forbidden("You do not have permission to edit member profiles.");
        }

        var displayName = Normalize(request.DisplayName);
        var email = Normalize(request.Email)?.ToLowerInvariant();
        var phoneE164 = Normalize(request.PhoneE164);
        var salutation = Normalize(request.Salutation);
        var sex = Normalize(request.Sex);

        if (string.IsNullOrWhiteSpace(displayName))
        {
            return AppResult<AdminMemberDto>.Validation("Display name is required.");
        }

        if (displayName.Length > 150)
        {
            return AppResult<AdminMemberDto>.Validation("Display name must be 150 characters or fewer.");
        }

        if (salutation is { Length: > 100 })
        {
            return AppResult<AdminMemberDto>.Validation("Salutation must be 100 characters or fewer.");
        }

        if (sex is { Length: > 40 })
        {
            return AppResult<AdminMemberDto>.Validation("Gender must be 40 characters or fewer.");
        }

        if (email is { Length: > 200 } || (email is not null && !EmailPattern().IsMatch(email)))
        {
            return AppResult<AdminMemberDto>.Validation("Enter a valid email address.");
        }

        if (phoneE164 is not null && !SupportedPhoneNumber.IsValid(phoneE164))
        {
            return AppResult<AdminMemberDto>.Validation("Select a supported phone region and enter a valid number.");
        }

        var target = await dbContext.Members.FirstOrDefaultAsync(
            member => member.Id == request.TargetMemberId,
            cancellationToken);
        if (target is null)
        {
            return AppResult<AdminMemberDto>.NotFound("Member was not found.");
        }

        if (target.IsRegistered && phoneE164 is not null)
        {
            var phoneInUse = await dbContext.Members.AnyAsync(
                member => member.Id != target.Id && member.IsRegistered && member.PhoneE164 == phoneE164,
                cancellationToken);
            if (phoneInUse)
            {
                return AppResult<AdminMemberDto>.Validation("This phone number is already used by another registered member.");
            }
        }

        var groupIds = await dbContext.GroupMemberships
            .AsNoTracking()
            .Where(membership => membership.MemberId == target.Id)
            .Select(membership => membership.GroupId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var before = new { target.DisplayName, target.Salutation, target.Sex, target.Email, target.PhoneE164 };
        var phoneChanged = !string.Equals(target.PhoneE164, phoneE164, StringComparison.Ordinal);
        var now = DateTime.UtcNow;

        target.DisplayName = displayName;
        target.Salutation = salutation;
        target.Sex = sex;
        target.Email = email;
        target.PhoneE164 = phoneE164;
        if (phoneChanged)
        {
            target.PhoneVerifiedUtc = null;
        }
        target.UpdatedUtc = now;

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "member.profile.update",
            EntityType = "member",
            EntityId = target.Id,
            TargetMemberId = target.Id,
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new { target.DisplayName, target.Salutation, target.Sex, target.Email, target.PhoneE164 }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var groupId in groupIds)
        {
            await groupCacheInvalidationService.RemoveMembershipsAsync(groupId, cancellationToken);
        }

        var dto = await AdminPlatformRoleHelpers.GetAdminMemberDtoAsync(dbContext, target.Id, cancellationToken);
        return dto is null
            ? AppResult<AdminMemberDto>.NotFound("Member was not found after update.")
            : AppResult<AdminMemberDto>.Success(dto);
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.CultureInvariant)]
    private static partial Regex EmailPattern();

}
