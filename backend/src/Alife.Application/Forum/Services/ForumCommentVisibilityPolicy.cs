using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Forum.Services;

internal static class ForumCommentVisibilityPolicy
{
	public static bool TryResolve(
		ForumPost post,
		ForumCommentVisibility? requestedVisibility,
		ForumComment? parentComment,
		out ForumCommentVisibility visibility,
		out string? error)
	{
		error = null;

		if (!post.GroupId.HasValue)
		{
			visibility = ForumCommentVisibility.Public;
			if (requestedVisibility == ForumCommentVisibility.GroupOnly)
			{
				error = "GroupOnly comment visibility requires a group forum post.";
				return false;
			}

			return true;
		}

		if (post.Visibility == ForumPostVisibility.GroupOnly)
		{
			visibility = ForumCommentVisibility.GroupOnly;
			return true;
		}

		visibility = requestedVisibility ?? ForumCommentVisibility.GroupOnly;
		if (visibility is not (ForumCommentVisibility.Public or ForumCommentVisibility.GroupOnly))
		{
			error = "Comment visibility is invalid.";
			return false;
		}

		if (parentComment?.Visibility == ForumCommentVisibility.GroupOnly &&
			visibility == ForumCommentVisibility.Public)
		{
			error = "A reply cannot be more public than its parent comment.";
			return false;
		}

		return true;
	}
}
