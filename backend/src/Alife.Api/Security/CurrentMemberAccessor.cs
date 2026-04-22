using System.Security.Claims;
using Alife.Application.Abstractions.Identity;

namespace Alife.Api.Security;

public class CurrentMemberAccessor(IHttpContextAccessor httpContextAccessor) : ICurrentMemberAccessor
{
    public Guid? GetCurrentMemberId()
    {
        var principal = GetCurrentPrincipal();
        var sub = principal?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal?.FindFirstValue("sub");

        return Guid.TryParse(sub, out var memberId) ? memberId : null;
    }

    public string? GetVerifiedLineUID()
        => GetCurrentPrincipal()?.FindFirstValue("verified_line_uid");

    private ClaimsPrincipal? GetCurrentPrincipal()
        => httpContextAccessor.HttpContext?.User;
}
