using Alife.Api.Results;
using Alife.Application.VisitContactRequests.Commands.CreateVisitContactRequest;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/visit-contact-requests")]
public class VisitContactRequestsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Create(
        CreateVisitContactRequestRequest request,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(
            new CreateVisitContactRequestCommand(
                request.DisplayName,
                request.Email,
                request.Phone,
                request.PreferredLanguage,
                request.Message,
                request.SourcePage,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                Request.Headers.UserAgent.ToString()),
            cancellationToken);

        return result.IsSuccess
            ? StatusCode(StatusCodes.Status201Created, result.Value)
            : this.ToActionResult(result);
    }

    public sealed record CreateVisitContactRequestRequest(
        string DisplayName,
        string? Email,
        string? Phone,
        string? PreferredLanguage,
        string? Message,
        string? SourcePage);
}
