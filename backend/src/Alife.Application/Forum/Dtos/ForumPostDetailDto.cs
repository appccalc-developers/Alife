using Alife.Domain.Enums;

namespace Alife.Application.Forum.Dtos;

public sealed record ForumPostDetailDto(
	Guid Id,
	Guid CategoryId,
	Guid? GroupId,
	string TitleJson,
	string BodyJson,
	string MediaJson,
	ForumPostVisibility Visibility,
	bool IsPinned,
	bool IsLocked,
	bool IsHidden,
	int CommentCount,
	DateTime? LastCommentUtc,
	DateTime CreatedUtc,
	DateTime UpdatedUtc,
	ForumAuthorDto Author,
	IReadOnlyList<ForumCommentDto> Comments);
