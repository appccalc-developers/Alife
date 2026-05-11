using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.ExtractEventFromChat;

public sealed class ExtractEventFromChatCommandHandler(IGeminiService geminiService)
    : IRequestHandler<ExtractEventFromChatCommand, AppResult<EventDto>>
{
    public async Task<AppResult<EventDto>> Handle(ExtractEventFromChatCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserMessage))
        {
            return AppResult<EventDto>.Validation("User message cannot be empty.");
        }

        var dto = await geminiService.ExtractEventAsync(request.UserMessage, cancellationToken);
        if (dto is null)
        {
            return AppResult<EventDto>.Validation("Gemini could not extract event details from the provided message.");
        }

        // Stamp the organizer ID from the authenticated user
        dto = dto with { OrganizerId = request.OrganizerId };

        return AppResult<EventDto>.Success(dto);
    }
}
