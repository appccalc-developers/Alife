namespace Alife.Application.Forum.Dtos;

public sealed record ForumCategoryDto(
	Guid Id,
	string NameJson,
	string? DescriptionJson,
	int SortOrder,
	bool IsEnabled);
