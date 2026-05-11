using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.ExtractEventFromChat;

/// <summary>Sends a natural-language message to Gemini and returns an <see cref="EventDto"/> draft.</summary>
public sealed record ExtractEventFromChatCommand(string UserMessage, string OrganizerId)
    : IRequest<AppResult<EventDto>>;
