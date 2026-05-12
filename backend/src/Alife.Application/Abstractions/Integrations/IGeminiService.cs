using Alife.Application.Events.Dtos;

namespace Alife.Application.Abstractions.Integrations;

/// <summary>Contract for calling Gemini to extract structured event data from natural-language input.</summary>
public interface IGeminiService
{
    /// <summary>
    /// Sends the user's natural-language message to Gemini together with the EventDto system
    /// instructions and returns either markdown follow-up content or a final parsed EventDto.
    /// </summary>
    Task<ExtractEventFromChatResponseDto?> ExtractEventAsync(string userMessage, CancellationToken cancellationToken = default);
}
