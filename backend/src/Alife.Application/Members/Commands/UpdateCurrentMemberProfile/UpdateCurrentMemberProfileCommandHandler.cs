using System.Text.Json;
using System.Text.RegularExpressions;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common;
using Alife.Application.Groups.Services;
using Alife.Application.Members.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.UpdateCurrentMemberProfile;

public sealed partial class UpdateCurrentMemberProfileCommandHandler(
    IAlifeDbContext dbContext,
    IGroupCacheInvalidationService groupCacheInvalidationService)
    : IRequestHandler<UpdateCurrentMemberProfileCommand, AppResult<MemberActionResultDto>>
{
    public async Task<AppResult<MemberActionResultDto>> Handle(
        UpdateCurrentMemberProfileCommand request,
        CancellationToken cancellationToken)
    {
        var displayName = Normalize(request.DisplayName);
        var email = Normalize(request.Email)?.ToLowerInvariant();
        var phoneE164 = Normalize(request.PhoneE164);

        if (displayName is null || displayName.Length > 150)
        {
            return AppResult<MemberActionResultDto>.Validation("Display name is required and must be 150 characters or fewer.");
        }

        if (email is { Length: > 200 } || (email is not null && !EmailPattern().IsMatch(email)))
        {
            return AppResult<MemberActionResultDto>.Validation("Enter a valid email address.");
        }

        if (phoneE164 is not null && !SupportedPhoneNumber.IsValid(phoneE164))
        {
            return AppResult<MemberActionResultDto>.Validation("Select a supported phone region and enter a valid number.");
        }

        var member = await dbContext.Members.FirstOrDefaultAsync(
            candidate => candidate.Id == request.CurrentMemberId,
            cancellationToken);
        if (member is null)
        {
            return AppResult<MemberActionResultDto>.NotFound("Current member was not found.");
        }

        if (member.IsRegistered && phoneE164 is not null && await dbContext.Members.AnyAsync(
                candidate => candidate.Id != member.Id && candidate.IsRegistered && candidate.PhoneE164 == phoneE164,
                cancellationToken))
        {
            return AppResult<MemberActionResultDto>.Validation("This phone number is already used by another registered member.");
        }

        var affectedGroupIds = await dbContext.GroupMemberships
            .AsNoTracking()
            .Where(membership => membership.MemberId == member.Id)
            .Select(membership => membership.GroupId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var before = new { member.DisplayName, member.Email, member.PhoneE164 };
        var phoneChanged = !string.Equals(member.PhoneE164, phoneE164, StringComparison.Ordinal);
        var now = DateTime.UtcNow;

        member.DisplayName = displayName;
        member.Email = email;
        member.PhoneE164 = phoneE164;
        member.UpdatedUtc = now;
        if (phoneChanged)
        {
            member.PhoneVerifiedUtc = null;
        }

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = member.Id,
            Action = "member.profile.self-update",
            EntityType = "member",
            EntityId = member.Id,
            TargetMemberId = member.Id,
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new { member.DisplayName, member.Email, member.PhoneE164 }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        foreach (var groupId in affectedGroupIds)
        {
            await groupCacheInvalidationService.RemoveMembershipsAsync(groupId, cancellationToken);
        }

        return AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(
            Ok: true,
            PhoneE164: member.PhoneE164,
            DisplayName: member.DisplayName,
            Email: member.Email,
            IsRegistered: member.IsRegistered));
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.CultureInvariant)]
    private static partial Regex EmailPattern();

}
