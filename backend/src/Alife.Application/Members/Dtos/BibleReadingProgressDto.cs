namespace Alife.Application.Members.Dtos;

public sealed record BibleReadingProgressDto(
    string Book,
    int Chapter,
    string Language,
    string? ZhVersion,
    string? EnVersion,
    DateTime UpdatedUtc);
