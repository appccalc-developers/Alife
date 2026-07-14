using System.Text.Json;
using System.Text.RegularExpressions;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.UpdateGroupMemberProfile;

public sealed partial class UpdateGroupMemberProfileCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService)
    : IRequestHandler<UpdateGroupMemberProfileCommand, AppResult<GroupMemberProfileDto>>
{
    public async Task<AppResult<GroupMemberProfileDto>> Handle(
        UpdateGroupMemberProfileCommand request,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId,
                request.CurrentMemberId,
                cancellationToken))
        {
            return AppResult<GroupMemberProfileDto>.Forbidden("You do not have permission to manage members in this group.");
        }

        var displayName = Normalize(request.DisplayName);
        var email = Normalize(request.Email)?.ToLowerInvariant();
        var phoneE164 = Normalize(request.PhoneE164);

        if (displayName is null || displayName.Length > 150)
        {
            return AppResult<GroupMemberProfileDto>.Validation("Display name is required and must be 150 characters or fewer.");
        }

        if (email is { Length: > 200 } || (email is not null && !EmailPattern().IsMatch(email)))
        {
            return AppResult<GroupMemberProfileDto>.Validation("Enter a valid email address.");
        }

        if (phoneE164 is not null && !SupportedPhoneNumber.IsValid(phoneE164))
        {
            return AppResult<GroupMemberProfileDto>.Validation("Select a supported phone region and enter a valid number.");
        }

        var target = await dbContext.GroupMemberships
            .Where(membership =>
                membership.GroupId == request.GroupId &&
                membership.MemberId == request.TargetMemberId)
            .Select(membership => membership.Member)
            .FirstOrDefaultAsync(cancellationToken);
        if (target is null)
        {
            return AppResult<GroupMemberProfileDto>.NotFound("Group member was not found.");
        }

        if (target.IsRegistered && phoneE164 is not null && await dbContext.Members.AnyAsync(
                member => member.Id != target.Id && member.IsRegistered && member.PhoneE164 == phoneE164,
                cancellationToken))
        {
            return AppResult<GroupMemberProfileDto>.Validation("This phone number is already used by another registered member.");
        }

        var affectedGroupIds = await dbContext.GroupMemberships
            .AsNoTracking()
            .Where(membership => membership.MemberId == target.Id)
            .Select(membership => membership.GroupId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var before = new { target.DisplayName, target.Email, target.PhoneE164 };
        var phoneChanged = !string.Equals(target.PhoneE164, phoneE164, StringComparison.Ordinal);
        var now = DateTime.UtcNow;

        target.DisplayName = displayName;
        target.Email = email;
        target.PhoneE164 = phoneE164;
        target.UpdatedUtc = now;
        if (phoneChanged)
        {
            target.PhoneVerifiedUtc = null;
        }

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "group.member.profile.update",
            EntityType = "member",
            EntityId = target.Id,
            TargetMemberId = target.Id,
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new { target.DisplayName, target.Email, target.PhoneE164 }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        foreach (var groupId in affectedGroupIds)
        {
            await groupCacheInvalidationService.RemoveMembershipsAsync(groupId, cancellationToken);
        }

        return AppResult<GroupMemberProfileDto>.Success(new GroupMemberProfileDto(
            target.Id,
            target.DisplayName,
            target.Email,
            target.PhoneE164));
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.CultureInvariant)]
    private static partial Regex EmailPattern();

}
