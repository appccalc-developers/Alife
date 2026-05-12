namespace Alife.Application.Events.Dtos;

public record ExtractEventFromChatResponseDto
{
    public string ResponseMode { get; init; } = "markdown";
    public string? Markdown { get; init; }
    public EventDto? Result { get; init; }
}
