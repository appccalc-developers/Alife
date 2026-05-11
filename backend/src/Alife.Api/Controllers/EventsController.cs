using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.ExtractEventFromChat;
using Alife.Api.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events")]
[Authorize]
public class EventsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    /// <summary>
    /// Accepts a natural-language message and returns a structured <c>EventDto</c> draft extracted by Gemini.
    /// </summary>
    [HttpPost("extract")]
    public async Task<IActionResult> ExtractFromChat(
        [FromBody] ExtractFromChatRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ExtractEventFromChatCommand(request.Message, currentMemberId.Value.ToString()),
            cancellationToken);

        return this.ToActionResult(result);
    }

    public record ExtractFromChatRequest(string Message);
}
