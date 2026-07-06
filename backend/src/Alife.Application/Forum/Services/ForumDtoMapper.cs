using Alife.Application.Forum.Dtos;
using Alife.Domain.Entities;

namespace Alife.Application.Forum.Services;

internal static class ForumDtoMapper
{
	public static ForumPostSummaryDto ToSummaryDto(ForumPost post) =>
		new(
			post.Id,
			post.CategoryId,
			post.GroupId,
			post.TitleJson,
			post.BodyJson,
			post.MediaJson,
			post.Visibility,
			post.IsPinned,
			post.IsLocked,
			post.IsHidden,
			post.CommentCount,
			post.LastCommentUtc,
			post.CreatedUtc,
			post.UpdatedUtc,
			new ForumAuthorDto(post.AuthorMember.Id, post.AuthorMember.DisplayName));

	public static ForumPostDetailDto ToDetailDto(ForumPost post, IReadOnlyList<ForumCommentDto> comments) =>
		new(
			post.Id,
			post.CategoryId,
			post.GroupId,
			post.TitleJson,
			post.BodyJson,
			post.MediaJson,
			post.Visibility,
			post.IsPinned,
			post.IsLocked,
			post.IsHidden,
			post.CommentCount,
			post.LastCommentUtc,
			post.CreatedUtc,
			post.UpdatedUtc,
			new ForumAuthorDto(post.AuthorMember.Id, post.AuthorMember.DisplayName),
			comments);

	public static ForumCommentDto ToCommentDto(ForumComment comment) =>
		new(
			comment.Id,
			comment.PostId,
			comment.ParentCommentId,
			comment.BodyJson,
			comment.MediaJson,
			comment.IsHidden,
			comment.CreatedUtc,
			comment.UpdatedUtc,
			new ForumAuthorDto(comment.AuthorMember.Id, comment.AuthorMember.DisplayName));
}
