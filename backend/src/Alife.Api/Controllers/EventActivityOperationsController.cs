using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/activity-operations")]
public sealed class EventActivityOperationsController(EventActivityOperationsService operations, ICurrentMemberAccessor current) : ControllerBase
{
    private string Match => Request.Headers.IfMatch.ToString();
    private string Key => Request.Headers["Idempotency-Key"].ToString();
    private IActionResult PrivateResult<T>(AppResult<T> result)
    {
        var response = this.ToActionResult(result);
        this.ApplyPrivateNoStoreHeaders();
        return response;
    }
    [HttpGet]
    public async Task<IActionResult> Get(Guid eventId, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.GetAsync(eventId, actor, ct)) : Unauthorized();
    }
    [HttpPut("projects/{activityId}/policy")]
    public async Task<IActionResult> Policy(Guid eventId, string activityId, ActivityProjectRules request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.SavePolicyAsync(eventId, activityId, actor, request, Match, ct)) : Unauthorized();
    }
    [HttpPut("projects/{activityId}/offers")]
    public async Task<IActionResult> Offer(Guid eventId, string activityId, SaveActivityOfferRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.SaveOfferAsync(eventId, activityId, actor, request, Match, ct)) : Unauthorized();
    }
    [HttpPost("projects/{activityId}/fees/{operation}")]
    public async Task<IActionResult> Fee(Guid eventId, string activityId, string operation, ActivityParticipationActionRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.FeeActionAsync(eventId, activityId, actor, operation, Match, Key, request, ct)) : Unauthorized();
    }
    [HttpPost("offers/{offerId:guid}/{operation}")]
    public async Task<IActionResult> ActOffer(Guid eventId, Guid offerId, string operation, ActivityParticipationActionRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.OfferActionAsync(eventId, offerId, actor, operation, Match, Key, request, ct)) : Unauthorized();
    }
    [HttpPut("offers/{offerId:guid}/space")]
    public async Task<IActionResult> Space(Guid eventId, Guid offerId, SaveActivitySpaceRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.SaveSpaceAsync(eventId, offerId, actor, request, Match, Key, ct)) : Unauthorized();
    }
    [HttpPost("selection/preview")]
    public async Task<IActionResult> Preview(Guid eventId, ActivitySelectionRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.PreviewSelectionAsync(eventId, actor, request, ct)) : Unauthorized();
    }
    [HttpPost("selection/apply")]
    public async Task<IActionResult> Apply(Guid eventId, ApplyActivitySelectionRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.ApplySelectionAsync(eventId, actor, request, Key, ct)) : Unauthorized();
    }
    [HttpPost("participations/{participationId:guid}/{operation}")]
    public async Task<IActionResult> Act(Guid eventId, Guid participationId, string operation, ActivityParticipationActionRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.ParticipationActionAsync(eventId, participationId, actor, operation, request, Match, Key, ct)) : Unauthorized();
    }
    [HttpGet("participants/{participantId:guid}/private-data")]
    public async Task<IActionResult> Private(Guid eventId, Guid participantId, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.GetPrivateDataAsync(eventId, participantId, actor, ct)) : Unauthorized();
    }
    [HttpPut("participants/{participantId:guid}/private-data")]
    public async Task<IActionResult> Private(Guid eventId, Guid participantId, SaveActivityPrivateDataRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? PrivateResult(await operations.SavePrivateDataAsync(eventId, participantId, actor, request, Match, ct)) : Unauthorized();
    }
}
