using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.RegisterMember;

public sealed class RegisterMemberCommandHandler(
    IAlifeDbContext dbContext,
    IJwtTokenService jwtTokenService)
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

        var verifiedPhoneE164 = request.VerifiedPhoneE164?.Trim();
        var verifiedLineUID = request.VerifiedLineUID?.Trim();
        Member? currentMember = null;

        if (request.CurrentMemberId is Guid currentMemberId)
        {
            currentMember = await dbContext.Members.FirstOrDefaultAsync(x => x.Id == currentMemberId, cancellationToken);
            if (currentMember is not null)
            {
                verifiedPhoneE164 ??= currentMember.PhoneE164;
                verifiedLineUID ??= currentMember.LineUID;

                if (currentMember.PhoneVerifiedUtc is null && !string.IsNullOrWhiteSpace(verifiedPhoneE164))
                {
                    currentMember.PhoneE164 = verifiedPhoneE164;
                    currentMember.PhoneVerifiedUtc = DateTime.UtcNow;
                }
            }
        }

        if (string.IsNullOrWhiteSpace(verifiedPhoneE164) && string.IsNullOrWhiteSpace(verifiedLineUID))
        {
            return AppResult<MemberRegistrationResultDto>.Validation("Phone or LINE verification required.");
        }

        var memberToRegister = currentMember;

        var memberToRegisterId = memberToRegister?.Id;

        Member? alreadyRegisteredMember = null;

        if (!string.IsNullOrWhiteSpace(verifiedLineUID))
        {
            alreadyRegisteredMember = await dbContext.Members.FirstOrDefaultAsync(
                x => x.IsRegistered && x.LineUID == verifiedLineUID && (!memberToRegisterId.HasValue || x.Id != memberToRegisterId.Value),
                cancellationToken);
        }

        if (alreadyRegisteredMember is null && !string.IsNullOrWhiteSpace(verifiedPhoneE164))
        {
            alreadyRegisteredMember = await dbContext.Members.FirstOrDefaultAsync(
                x => x.IsRegistered && x.PhoneE164 == verifiedPhoneE164 && (!memberToRegisterId.HasValue || x.Id != memberToRegisterId.Value),
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
                PhoneE164 = string.IsNullOrWhiteSpace(verifiedPhoneE164) ? null : verifiedPhoneE164,
                LineUID = string.IsNullOrWhiteSpace(verifiedLineUID) ? null : verifiedLineUID,
                PhoneVerifiedUtc = string.IsNullOrWhiteSpace(verifiedPhoneE164) ? null : DateTime.UtcNow,
                IsRegistered = false,
                IsAdmin = false,
                CreatedUtc = DateTime.UtcNow
            };

            dbContext.Members.Add(memberToRegister);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(verifiedPhoneE164))
            {
                memberToRegister.PhoneE164 = verifiedPhoneE164;
                memberToRegister.PhoneVerifiedUtc ??= DateTime.UtcNow;
            }

            if (!string.IsNullOrWhiteSpace(verifiedLineUID))
            {
                memberToRegister.LineUID = verifiedLineUID;
            }
        }

        memberToRegister.DisplayName = request.Name.Trim();
        memberToRegister.Sex = request.Sex;
        memberToRegister.Age = request.Age;
        memberToRegister.Email = request.Email;
        memberToRegister.IsRegistered = true;

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
                    CreatedUtc = DateTime.UtcNow,
                    UpdatedUtc = DateTime.UtcNow
                });
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var (token, expiresUtc) = jwtTokenService.CreateToken(memberToRegister, isGuest: false);
        return AppResult<MemberRegistrationResultDto>.Success(new MemberRegistrationResultDto(token, expiresUtc));
    }
}
