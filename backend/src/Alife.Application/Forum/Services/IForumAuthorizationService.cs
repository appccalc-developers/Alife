using Alife.Domain.Entities;

namespace Alife.Application.Forum.Services;

public interface IForumAuthorizationService
{
	Task<bool> CanReadPostAsync(ForumPost post, Guid? currentMemberId, CancellationToken cancellationToken);
	Task<bool> CanWriteSiteForumAsync(Guid memberId, CancellationToken cancellationToken);
	Task<bool> CanModerateSiteForumAsync(Guid memberId, CancellationToken cancellationToken);
	Task<bool> CanWriteGroupForumAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken);
	Task<bool> CanModerateGroupForumAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken);
}
