using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using Alife.Application.Notifications.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.RegisterMember;

public sealed class RegisterMemberCommandHandler(
    IAlifeDbContext dbContext,
    IJwtTokenService jwtTokenService,
    IGroupCacheInvalidationService groupCacheInvalidationService)
    : IRequestHandler<RegisterMemberCommand, AppResult<MemberRegistrationResultDto>>
{
    public async Task<AppResult<MemberRegistrationResultDto>> Handle(
        RegisterMemberCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return AppResult<MemberRegistrationResultDto>.Validation("Name is required.");
        }

        var verifiedLineUID = request.VerifiedLineUID?.Trim();
        var now = DateTime.UtcNow;
        Member? currentMember = null;

        if (request.CurrentMemberId is Guid currentMemberId)
        {
            currentMember = await dbContext.Members
                .Include(x => x.PlatformRoles)
                .ThenInclude(x => x.Role)
                .FirstOrDefaultAsync(x => x.Id == currentMemberId, cancellationToken);
            if (currentMember is not null)
            {
                verifiedLineUID ??= currentMember.LineUID;
            }
        }

        if (string.IsNullOrWhiteSpace(verifiedLineUID))
        {
            return AppResult<MemberRegistrationResultDto>.Validation("LINE verification required.");
        }

        var memberToRegister = currentMember;

        var memberToRegisterId = memberToRegister?.Id;

        Member? alreadyRegisteredMember = null;

        if (!string.IsNullOrWhiteSpace(verifiedLineUID))
        {
            alreadyRegisteredMember = await dbContext.Members
                .Include(x => x.PlatformRoles)
                .ThenInclude(x => x.Role)
                .FirstOrDefaultAsync(
                x => x.IsRegistered && x.LineUID == verifiedLineUID && (!memberToRegisterId.HasValue || x.Id != memberToRegisterId.Value),
                cancellationToken);
        }

        if (alreadyRegisteredMember is not null)
        {
            memberToRegister = alreadyRegisteredMember;
        }
        else if (memberToRegister is null)
        {
            memberToRegister = new Member
            {
                Id = Guid.NewGuid(),
                LineUID = string.IsNullOrWhiteSpace(verifiedLineUID) ? null : verifiedLineUID,
                IsRegistered = false,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.Members.Add(memberToRegister);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(verifiedLineUID))
            {
                memberToRegister.LineUID = verifiedLineUID;
            }
        }

        var wasRegistered = memberToRegister.IsRegistered;

        memberToRegister.DisplayName = request.Name.Trim();
        memberToRegister.Sex = request.Sex;
        memberToRegister.Age = request.Age;
        memberToRegister.Email = request.Email;
        memberToRegister.IsRegistered = true;
        memberToRegister.UpdatedUtc = now;

        var church = await dbContext.Groups.FirstOrDefaultAsync(x => x.IsChurch, cancellationToken);
        if (church is not null)
        {
            var exists = await dbContext.GroupMemberships.AnyAsync(
                x => x.GroupId == church.Id &&
                     x.MemberId == memberToRegister.Id &&
                     (x.Status == MembershipStatus.Requested || x.Status == MembershipStatus.Approved),
                cancellationToken);

            if (!exists && church.AccessType == AccessType.Protected)
            {
                dbContext.GroupMemberships.Add(new GroupMembership
                {
                    Id = Guid.NewGuid(),
                    GroupId = church.Id,
                    MemberId = memberToRegister.Id,
                    Status = MembershipStatus.Requested,
                    Role = MembershipRole.Member,
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
            }
        }

        if (!wasRegistered && !string.IsNullOrWhiteSpace(memberToRegister.LineUID))
        {
            await MembershipNotificationWriter.NotifyChurchLeadersOfLineRegistrationAsync(
                dbContext,
                memberToRegister.Id,
                memberToRegister.DisplayName,
                cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        if (church is not null)
        {
            await groupCacheInvalidationService.RemoveMembershipsAsync(church.Id, cancellationToken);
        }

        var (token, expiresUtc) = jwtTokenService.CreateToken(memberToRegister, isGuest: false);
        return AppResult<MemberRegistrationResultDto>.Success(new MemberRegistrationResultDto(token, expiresUtc));
    }
}
