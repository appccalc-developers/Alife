using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.ExtractEventFromChat;

public sealed class ExtractEventFromChatCommandHandler(IGeminiService geminiService)
    : IRequestHandler<ExtractEventFromChatCommand, AppResult<ExtractEventFromChatResponseDto>>
{
    public async Task<AppResult<ExtractEventFromChatResponseDto>> Handle(ExtractEventFromChatCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserMessage))
        {
            return AppResult<ExtractEventFromChatResponseDto>.Validation("User message cannot be empty.");
        }

        var response = await geminiService.ExtractEventAsync(request.UserMessage, cancellationToken);
        if (response is null)
        {
            return AppResult<ExtractEventFromChatResponseDto>.Validation("Gemini could not process the provided message.");
        }

        // Stamp the organizer ID from the authenticated user when a final EventDto exists.
        if (response.Result is not null)
        {
            response = response with
            {
                Result = response.Result with { OrganizerId = request.OrganizerId }
            };
        }

        return AppResult<ExtractEventFromChatResponseDto>.Success(response);
    }
}
