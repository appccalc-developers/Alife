using Alife.Application.Members.Dtos;
using Alife.Application.Members.Services;
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
                !x.IsRegistered,
                x.IsRegistered,
                x.IsAdmin,
                x.Memberships
                    .Select(m => new MemberMembershipDto(
                        m.GroupId,
                        m.Status.ToString(),
                        m.Role.ToString()))
                    .ToList()))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
