using Alife.Application.Events.Dtos;

namespace Alife.Application.Abstractions.Integrations;

/// <summary>Contract for calling Gemini to extract structured event data from natural-language input.</summary>
public interface IGeminiService
{
    /// <summary>
    /// Sends the user's natural-language message to Gemini together with the EventDto system
    /// instructions and returns a partially-or-fully populated <see cref="EventDto"/>.
    /// </summary>
    Task<EventDto?> ExtractEventAsync(string userMessage, CancellationToken cancellationToken = default);
}
