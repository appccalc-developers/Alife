using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/packages")]
[Authorize]
public sealed class EventPackagesController(
    IEventPackageService packages,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> List(Guid eventId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] EventPackageStatus? status = null, [FromQuery] EventPackageScopeType? scopeType = null,
        [FromQuery] Guid? scopeId = null, [FromQuery] string sort = "versionDesc", CancellationToken ct = default)
        => Run(member => packages.ListAsync(eventId, member,
            new(page, pageSize, status, scopeType, scopeId, sort), ct));

    [HttpGet("current")]
    public Task<IActionResult> Current(Guid eventId, [FromQuery] EventPackageScopeType scopeType,
        [FromQuery] Guid? scopeId, CancellationToken ct)
        => Run(member => packages.GetCurrentAsync(eventId, member, scopeType, scopeId, ct), value => value.ETag);

    [HttpGet("{packageId:guid}")]
    public Task<IActionResult> Get(Guid eventId, Guid packageId, CancellationToken ct)
        => Run(member => packages.GetAsync(eventId, packageId, member, ct), value => value.ETag);

    [HttpGet("{packageId:guid}/diff/{otherPackageId:guid}")]
    public Task<IActionResult> Diff(Guid eventId, Guid packageId, Guid otherPackageId, CancellationToken ct)
        => Run(member => packages.DiffAsync(eventId, packageId, otherPackageId, member, ct));

    [HttpGet("{packageId:guid}/capabilities")]
    public Task<IActionResult> Capabilities(Guid eventId, Guid packageId, CancellationToken ct)
        => Run(member => packages.GetCapabilitiesAsync(eventId, packageId, member, ct));

    [HttpPost("generate")]
    public Task<IActionResult> Generate(Guid eventId, GenerateEventPackageRequest request, CancellationToken ct)
        => Run(member => packages.GenerateAsync(eventId, member, request, Request.Headers.IfMatch.ToString(),
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ETag);

    [HttpPost("{packageId:guid}/submit")]
    public Task<IActionResult> Submit(Guid eventId, Guid packageId, CancellationToken ct)
        => Run(member => packages.SubmitAsync(eventId, packageId, member, Request.Headers.IfMatch.ToString(),
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ETag);

    [HttpPost("{packageId:guid}/withdraw")]
    public Task<IActionResult> Withdraw(Guid eventId, Guid packageId, CancellationToken ct)
        => Run(member => packages.WithdrawAsync(eventId, packageId, member, Request.Headers.IfMatch.ToString(),
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ETag);

    [HttpPost("{packageId:guid}/decisions")]
    public Task<IActionResult> Decide(Guid eventId, Guid packageId, EventPackageDecisionRequest request, CancellationToken ct)
        => Run(member => packages.DecideAsync(eventId, packageId, member, request, Request.Headers.IfMatch.ToString(),
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ETag);

    [HttpGet("~/api/events/{eventId:guid}/lifecycle-gates")]
    public Task<IActionResult> Lifecycle(Guid eventId, [FromQuery] Guid? occurrenceId, CancellationToken ct)
        => Run(member => packages.GetLifecycleAsync(eventId, member, ct, occurrenceId), value => value.ETag);

    [HttpPost("~/api/events/{eventId:guid}/publish")]
    public Task<IActionResult> Publish(Guid eventId, PublishEventRequest request, CancellationToken ct)
        => Run(member => packages.PublishAsync(eventId, member, request,
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ETag);

    [HttpPost("~/api/events/{eventId:guid}/unpublish")]
    public Task<IActionResult> Unpublish(Guid eventId, UnpublishEventRequest request, CancellationToken ct)
        => Run(member => packages.UnpublishAsync(eventId, member, request,
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ETag);

    [HttpPost("{packageId:guid}/decisions/{decisionId:guid}/revoke")]
    public Task<IActionResult> RevokeDecision(Guid eventId, Guid packageId, Guid decisionId,
        RevokeEventPackageDecisionRequest request, CancellationToken ct)
        => Run(member => packages.RevokeDecisionAsync(eventId, packageId, decisionId, member, request,
            Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ETag);

    [HttpPost("{packageId:guid}/conditions/{conditionId:guid}/satisfy")]
    public Task<IActionResult> SatisfyCondition(Guid eventId, Guid packageId, Guid conditionId,
        SatisfyEventPackageConditionRequest request, CancellationToken ct)
        => Run(member => packages.SatisfyConditionAsync(eventId, packageId, conditionId, member, request,
            Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct), value => value.Condition.ETag);

    [HttpPost("{packageId:guid}/conditions/{conditionId:guid}/verify")]
    public Task<IActionResult> VerifyCondition(Guid eventId, Guid packageId, Guid conditionId,
        VerifyEventPackageConditionRequest request, CancellationToken ct)
        => Run(member => packages.VerifyConditionAsync(eventId, packageId, conditionId, member, request,
            Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct), value => value.Condition.ETag);

    [HttpPost("{packageId:guid}/conditions/{conditionId:guid}/waive")]
    public Task<IActionResult> WaiveCondition(Guid eventId, Guid packageId, Guid conditionId,
        WaiveEventPackageConditionRequest request, CancellationToken ct)
        => Run(member => packages.WaiveConditionAsync(eventId, packageId, conditionId, member, request,
            Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct), value => value.Condition.ETag);

    [HttpPost("~/api/events/{eventId:guid}/registration/open")]
    public Task<IActionResult> OpenRegistration(Guid eventId, OpenEventRegistrationRequest request, CancellationToken ct)
        => Run(member => packages.OpenRegistrationAsync(eventId, member, request,
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.RegistrationETag);

    [HttpPost("~/api/events/{eventId:guid}/registration/close")]
    public Task<IActionResult> CloseRegistration(Guid eventId, CloseEventRegistrationRequest request, CancellationToken ct)
        => Run(member => packages.CloseRegistrationAsync(eventId, member, request,
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.RegistrationETag);

    [HttpPost("~/api/events/{eventId:guid}/execution/confirm")]
    public Task<IActionResult> ConfirmExecution(Guid eventId, ConfirmEventExecutionRequest request, CancellationToken ct)
        => Run(member => packages.ConfirmExecutionAsync(eventId, member, request,
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ExecutionETag);

    private async Task<IActionResult> Run<T>(
        Func<Guid, Task<Alife.Application.Common.Models.AppResult<T>>> action,
        Func<T, string>? eTag = null)
    {
        this.ApplyPrivateNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await action(memberId.Value);
        if (result.IsSuccess && eTag is not null) Response.Headers.ETag = eTag(result.Value!);
        return this.ToActionResult(result);
    }
}
