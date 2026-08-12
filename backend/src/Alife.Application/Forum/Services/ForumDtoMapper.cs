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
			post.SermonId,
			ToSermonDto(post),
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

	public static ForumPostDetailDto ToDetailDto(
		ForumPost post,
		IReadOnlyList<ForumCommentDto> comments,
		bool useVisibleCommentMetadata = false,
		bool restrictUpdatedUtc = false)
	{
		var lastVisibleCommentUtc = comments.Count > 0 ? comments.Max(x => x.CreatedUtc) : (DateTime?)null;

		return new(
			post.Id,
			post.CategoryId,
			post.GroupId,
			post.SermonId,
			ToSermonDto(post),
			post.TitleJson,
			post.BodyJson,
			post.MediaJson,
			post.Visibility,
			post.IsPinned,
			post.IsLocked,
			post.IsHidden,
			useVisibleCommentMetadata ? comments.Count : post.CommentCount,
			useVisibleCommentMetadata ? lastVisibleCommentUtc : post.LastCommentUtc,
			post.CreatedUtc,
			restrictUpdatedUtc ? lastVisibleCommentUtc ?? post.CreatedUtc : post.UpdatedUtc,
			new ForumAuthorDto(post.AuthorMember.Id, post.AuthorMember.DisplayName),
			comments);
	}

	public static ForumCommentDto ToCommentDto(ForumComment comment) =>
		new(
			comment.Id,
			comment.PostId,
			comment.ParentCommentId,
			comment.BodyJson,
			comment.MediaJson,
			comment.Visibility,
			comment.IsHidden,
			comment.CreatedUtc,
			comment.UpdatedUtc,
			new ForumAuthorDto(comment.AuthorMember.Id, comment.AuthorMember.DisplayName));

	private static ForumSermonDto? ToSermonDto(ForumPost post) =>
		post.Sermon is null
			? null
			: new ForumSermonDto(
				post.Sermon.Id,
				post.Sermon.Title,
				post.Sermon.SpeakerName,
				post.Sermon.ThumbnailUrl,
				BuildSermonVideoUrl(post.Sermon.VideoUrl, post.Sermon.YoutubeVideoId),
				post.Sermon.PreachedAtUtc);

	private static string? BuildSermonVideoUrl(string? videoUrl, string youtubeVideoId)
	{
		if (!string.IsNullOrWhiteSpace(videoUrl))
		{
			return videoUrl;
		}

		return string.IsNullOrWhiteSpace(youtubeVideoId)
			? null
			: $"https://www.youtube.com/watch?v={youtubeVideoId}";
	}
}
