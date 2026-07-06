using Alife.Application.Forum.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Infrastructure.Services;

public sealed class ForumAuthorizationService(IGroupAuthorizationService groupAuthorizationService)
	: IForumAuthorizationService
{
	public async Task<bool> CanReadPostAsync(
		ForumPost post,
		Guid? currentMemberId,
		CancellationToken cancellationToken)
	{
		if (post.IsHidden)
		{
			if (currentMemberId is null)
			{
				return false;
			}

			return post.GroupId.HasValue
				? await CanModerateGroupForumAsync(post.GroupId.Value, currentMemberId.Value, cancellationToken)
				: await CanModerateSiteForumAsync(currentMemberId.Value, cancellationToken);
		}

		return post.Visibility switch
		{
			ForumPostVisibility.Public => true,
			ForumPostVisibility.MembersOnly => currentMemberId.HasValue &&
				await CanWriteSiteForumAsync(currentMemberId.Value, cancellationToken),
			ForumPostVisibility.GroupOnly => post.GroupId.HasValue &&
				currentMemberId.HasValue &&
				await groupAuthorizationService.IsApprovedMemberAsync(
					post.GroupId.Value,
					currentMemberId.Value,
					cancellationToken),
			_ => false
		};
	}

	public Task<bool> CanWriteSiteForumAsync(Guid memberId, CancellationToken cancellationToken)
		=> groupAuthorizationService.IsRegisteredMemberAsync(memberId, cancellationToken);

	public Task<bool> CanModerateSiteForumAsync(Guid memberId, CancellationToken cancellationToken)
		=> groupAuthorizationService.IsAdminAsync(memberId, cancellationToken);

	public Task<bool> CanWriteGroupForumAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken)
		=> groupAuthorizationService.IsApprovedMemberAsync(groupId, memberId, cancellationToken);

	public Task<bool> CanModerateGroupForumAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken)
		=> groupAuthorizationService.IsLeaderOrCoLeaderAsync(groupId, memberId, cancellationToken);
}
