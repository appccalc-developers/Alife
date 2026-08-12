using Alife.Domain.Enums;

namespace Alife.Application.Forum.Dtos;

public sealed record ForumCommentDto(
	Guid Id,
	Guid PostId,
	Guid? ParentCommentId,
	string BodyJson,
	string MediaJson,
	ForumCommentVisibility Visibility,
	bool IsHidden,
	DateTime CreatedUtc,
	DateTime UpdatedUtc,
	ForumAuthorDto Author);
