using Alife.Application.Common;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Services;
using Alife.Domain.Constants;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Infrastructure.ReadServices;

public sealed class MemberReadService(AlifeDbContext dbContext) : IMemberReadService
{
    public async Task<CurrentMemberDto?> GetCurrentMemberAsync(Guid memberId, CancellationToken cancellationToken)
    {
        var member = await dbContext.Members
            .AsNoTracking()
            .Where(x => x.Id == memberId)
            .Select(x => new
            {
                x.Id,
                x.DisplayName,
                x.Sex,
                x.Age,
                x.Email,
                x.PhoneE164,
                x.Language,
                x.IsRegistered,
                x.IsAdmin,
                Memberships = x.Memberships
                    .Select(m => new
                    {
                        m.GroupId,
                        m.Status,
                        m.Role,
                        GroupNameJson = m.Group.NameJson,
                        m.Group.ParentGroupId
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);

        return member is null
            ? null
            : new CurrentMemberDto(
                member.Id,
                member.DisplayName,
                member.Sex,
                member.Age,
                member.Email,
                member.PhoneE164,
                MemberLanguage.Normalize(member.Language),
                !member.IsRegistered,
                member.IsRegistered,
                member.IsAdmin,
                member.Memberships
                    .Select(m => new MemberMembershipDto(
                        m.GroupId,
                        EnumName.CamelCase(m.Status),
                        EnumName.CamelCase(m.Role),
                        ReadTextMap(m.GroupNameJson),
                        m.ParentGroupId))
                    .ToList());
    }

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
