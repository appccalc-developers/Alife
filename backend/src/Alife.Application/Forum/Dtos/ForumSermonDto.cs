namespace Alife.Application.Forum.Dtos;

public sealed record ForumSermonDto(
	Guid Id,
	string Title,
	string SpeakerName,
	string? ThumbnailUrl,
	string? VideoUrl,
	DateTime? PreachedAt);
