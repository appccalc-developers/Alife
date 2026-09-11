using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/preparation")]
public sealed class EventPreparationController(IEventPackageService packages, ICurrentMemberAccessor memberAccessor) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> Get(Guid eventId, CancellationToken ct) => Run(member => packages.GetPreparationAsync(eventId, member, ct));
    [HttpPost("reopen-requests")]
    public Task<IActionResult> RequestReopen(Guid eventId, RequestEventPreparationReopen request, CancellationToken ct) =>
        Run(member => packages.RequestPreparationReopenAsync(eventId, member, request, Request.Headers["Idempotency-Key"].ToString(), ct));
    [HttpPost("reopen-requests/{requestId:guid}/review")]
    public Task<IActionResult> Review(Guid eventId, Guid requestId, ReviewEventPreparationReopen request, CancellationToken ct) =>
        Run(member => packages.ReviewPreparationReopenAsync(eventId, requestId, member, request, Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct));
    private async Task<IActionResult> Run(Func<Guid, Task<Alife.Application.Common.Models.AppResult<EventPreparationStateDto>>> action)
    {
        this.ApplyPrivateNoStoreHeaders();
        var member = memberAccessor.GetCurrentMemberId();
        return member.HasValue ? this.ToActionResult(await action(member.Value)) : Unauthorized();
    }
}
