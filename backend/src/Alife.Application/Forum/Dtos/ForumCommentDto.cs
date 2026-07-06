namespace Alife.Application.Forum.Dtos;

public sealed record ForumCommentDto(
	Guid Id,
	Guid PostId,
	Guid? ParentCommentId,
	string BodyJson,
	string MediaJson,
	bool IsHidden,
	DateTime CreatedUtc,
	DateTime UpdatedUtc,
	ForumAuthorDto Author);
