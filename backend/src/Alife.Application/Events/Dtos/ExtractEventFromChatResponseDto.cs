namespace Alife.Application.Events.Dtos;

public record ExtractEventFromChatResponseDto
{
    public string ResponseMode { get; init; } = "markdown";
    public string? SessionId { get; init; }
    public string? Markdown { get; init; }
    public EventDto? Result { get; init; }
    public MultilingualString? LegacySummary { get; init; }
}
