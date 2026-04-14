namespace Alife.Application.Sermons.Dtos;

public sealed record SermonDto(
    Guid Id,
    string Title,
    string SpeakerName,
    string? ThumbnailUrl,
    string? VideoUrl,
    DateTime? PreachedAt);
