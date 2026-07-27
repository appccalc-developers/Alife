using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Members.Dtos;
using Alife.Application.Notifications.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.LineLogin;

public sealed class LineLoginCommandHandler(
    IAlifeDbContext dbContext,
    ILineLoginService lineLoginService,
    IJwtTokenService jwtTokenService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<LineLoginCommand, AppResult<MemberActionResultDto>>
{
    public async Task<AppResult<MemberActionResultDto>> Handle(
        LineLoginCommand request,
        CancellationToken cancellationToken)
    {
        var lineResult = await lineLoginService.ExchangeCodeAsync(request.Code, cancellationToken);
        if (lineResult is null)
        {
            return AppResult<MemberActionResultDto>.Validation("LINE login failed. Could not exchange authorization code.");
        }

        var lineUID = lineResult.LineUID;

        var member = request.CurrentMemberId is Guid currentMemberId
            ? await dbContext.Members.FirstOrDefaultAsync(x => x.Id == currentMemberId, cancellationToken)
            : null;

        var memberId = member?.Id;

        var existingRegisteredMember = await dbContext.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.IsRegistered && x.LineUID == lineUID && (!memberId.HasValue || x.Id != memberId.Value),
                cancellationToken);

        if (member?.IsRegistered == true && existingRegisteredMember is not null)
        {
            return AppResult<MemberActionResultDto>.Conflict("LINE account already registered to another member.");
        }

        if (existingRegisteredMember is not null)
        {
            var requestedChurchGroupId = await RequestChurchMembershipIfMissingAsync(
                existingRegisteredMember.Id,
                cancellationToken);

            if (requestedChurchGroupId is Guid churchGroupId)
            {
                await dbContext.SaveChangesAsync(cancellationToken);
                await Task.WhenAll(
                    groupCacheInvalidationService.RemoveMembershipsAsync(churchGroupId, cancellationToken),
                    cloudflareKvCacheService.RemoveMembershipAsync(
                        churchGroupId,
                        existingRegisteredMember.Id,
                        cancellationToken),
                    cloudflareKvCacheService.RemoveMemberProfileAsync(
                        existingRegisteredMember.Id,
                        cancellationToken),
                    cloudflareKvCacheService.RemoveApiCacheKeyAsync(
                        $"member:{existingRegisteredMember.Id}:me",
                        cancellationToken));
            }

            var (Token, ExpiresUtc) = jwtTokenService.CreateToken(existingRegisteredMember, isGuest: false);
            return AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(
                true,
                DisplayName: existingRegisteredMember.DisplayName,
                Sex: existingRegisteredMember.Sex,
                Age: existingRegisteredMember.Age,
                Email: existingRegisteredMember.Email,
                IsRegistered: true,
                Token: Token,
                ExpiresUtc: ExpiresUtc));
        }

        string? token = null;
        DateTime? expiresUtc = null;

        if (member is not null)
        {
            member.LineUID = lineUID;
            member.UpdatedUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            var onboardingToken = jwtTokenService.CreateVerifiedLineToken(lineUID, lineResult.DisplayName, lineResult.Email);
            token = onboardingToken.Token;
            expiresUtc = onboardingToken.ExpiresUtc;
        }

        return AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(
            true,
            DisplayName: lineResult.DisplayName,
            Email: lineResult.Email,
            IsRegistered: false,
            Token: token,
            ExpiresUtc: expiresUtc));
    }

    private async Task<Guid?> RequestChurchMembershipIfMissingAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var churchGroupId = await dbContext.Groups
            .AsNoTracking()
            .Where(x =>
                x.IsChurch &&
                !x.IsClosed &&
                x.AccessType == AccessType.Protected)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (churchGroupId is not Guid groupId)
        {
            return null;
        }

        var hasMembershipHistory = await dbContext.GroupMemberships
            .AsNoTracking()
            .AnyAsync(
                x => x.GroupId == groupId && x.MemberId == memberId,
                cancellationToken);

        if (hasMembershipHistory)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = memberId,
            Status = MembershipStatus.Requested,
            Role = MembershipRole.Member,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        await MembershipNotificationWriter.NotifyGroupLeadersOfJoinRequestAsync(
            dbContext,
            groupId,
            memberId,
            cancellationToken);

        return groupId;
    }
}
