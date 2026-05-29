using Alife.Application.Common;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Services;
using Alife.Domain.Constants;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.ReadServices;

public sealed class MemberReadService(AlifeDbContext dbContext) : IMemberReadService
{
    public async Task<CurrentMemberDto?> GetCurrentMemberAsync(Guid memberId, CancellationToken cancellationToken)
    {
        return await dbContext.Members
            .AsNoTracking()
            .Where(x => x.Id == memberId)
            .Select(x => new CurrentMemberDto(
                x.Id,
                x.DisplayName,
                x.Sex,
                x.Age,
                x.Email,
                x.PhoneE164,
                MemberLanguage.Normalize(x.Language),
                !x.IsRegistered,
                x.IsRegistered,
                x.IsAdmin,
                x.Memberships
                    .Select(m => new MemberMembershipDto(
                        m.GroupId,
                        EnumName.CamelCase(m.Status),
                        EnumName.CamelCase(m.Role)))
                    .ToList()))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
