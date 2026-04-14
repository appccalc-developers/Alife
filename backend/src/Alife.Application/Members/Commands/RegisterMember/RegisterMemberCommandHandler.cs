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

        var member = await dbContext.Members.FirstOrDefaultAsync(x => x.Id == request.CurrentMemberId, cancellationToken);
        if (member is null)
        {
            return AppResult<MemberRegistrationResultDto>.NotFound("Current member was not found.");
        }

        if (member.PhoneVerifiedUtc is null)
        {
            return AppResult<MemberRegistrationResultDto>.Validation("Phone verification required.");
        }

        var memberToRegister = member;

        if (!string.IsNullOrWhiteSpace(member.PhoneE164))
        {
            var alreadyRegisteredMember = await dbContext.Members.FirstOrDefaultAsync(
                x => x.Id != member.Id && x.IsRegistered && x.PhoneE164 == member.PhoneE164,
                cancellationToken);

            if (alreadyRegisteredMember is not null)
            {
                memberToRegister = alreadyRegisteredMember;
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
