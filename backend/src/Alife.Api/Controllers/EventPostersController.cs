using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.SaveEventPoster;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/poster")]
public sealed class EventPostersController(IMediator mediator, ICurrentMemberAccessor memberAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid eventId, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var member = memberAccessor.GetCurrentMemberId();
        if (!member.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventPosterQuery(eventId, member.Value), ct);
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }
    public sealed record SavePosterRequest(string? PosterImageUrl);
    [HttpPut]
    public async Task<IActionResult> Put(Guid eventId, SavePosterRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var member = memberAccessor.GetCurrentMemberId();
        if (!member.HasValue) return Unauthorized();
        var result = await mediator.Send(new SaveEventPosterCommand(eventId, member.Value, request.PosterImageUrl,
            Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString()), ct);
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }
}
