using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/registration-work")]
public sealed class EventRegistrationWorkController(EventRegistrationWorkService registration, ICurrentMemberAccessor current) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid eventId, CancellationToken ct, [FromQuery] int page = 1, [FromQuery] string? search = null, [FromQuery] Guid? application = null)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await registration.GetAsync(eventId, actor, page, search, ct, application)) : Unauthorized();
    }
    [HttpPut("rules")]
    public async Task<IActionResult> Rules(Guid eventId, RegistrationRules request, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await registration.SaveRulesAsync(eventId, actor, request, Request.Headers.IfMatch.ToString(), ct)) : Unauthorized();
    }
    [HttpPost("applications")]
    public async Task<IActionResult> Create(Guid eventId, RegistrationApplicationRequest request, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await registration.CreateAsync(eventId, actor, request, Request.Headers["Idempotency-Key"].ToString(), ct)) : Unauthorized();
    }
    [HttpGet("applications/{applicationId:guid}/history")]
    public async Task<IActionResult> History(Guid eventId, Guid applicationId, CancellationToken ct, [FromQuery] int page = 1)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await registration.HistoryAsync(eventId, applicationId, actor, page, ct)) : Unauthorized();
    }
    [HttpPost("applications/{applicationId:guid}/{operation}")]
    public async Task<IActionResult> Act(Guid eventId, Guid applicationId, string operation, RegistrationActionRequest request, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await registration.ActAsync(eventId, applicationId, actor, operation, request, Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct)) : Unauthorized();
    }
    [HttpPost("fees/{operation}")]
    public async Task<IActionResult> Fees(Guid eventId, string operation, FeeReason request, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await registration.FeesAsync(eventId, actor, operation, request.Reason, Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct)) : Unauthorized();
    }
    public sealed record FeeReason(string? Reason);
}
