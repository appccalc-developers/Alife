using Alife.Application.Members.Dtos;

namespace Alife.Application.Members.Services;

public interface IMemberReadService
{
    Task<CurrentMemberDto?> GetCurrentMemberAsync(Guid memberId, CancellationToken cancellationToken);
}
