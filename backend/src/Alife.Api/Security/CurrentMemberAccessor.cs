using System.Security.Claims;
using Alife.Application.Abstractions.Identity;

namespace Alife.Api.Security;

public class CurrentMemberAccessor(IHttpContextAccessor httpContextAccessor) : ICurrentMemberAccessor
{
    public Guid? GetCurrentMemberId()
    {
        var sub = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? httpContextAccessor.HttpContext?.User.FindFirstValue("sub");

        return Guid.TryParse(sub, out var memberId) ? memberId : null;
    }

    public string? GetVerifiedPhoneE164()
        => httpContextAccessor.HttpContext?.User.FindFirstValue("verified_phone");

    public string? GetVerifiedLineUID()
        => httpContextAccessor.HttpContext?.User.FindFirstValue("verified_line_uid");
}
