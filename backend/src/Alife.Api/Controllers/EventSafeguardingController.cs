using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/safeguarding")]
[Authorize]
public sealed class EventSafeguardingController(
    IEventSafeguardingService safeguarding,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> GetWorkspace(Guid eventId, [FromQuery] Guid? occurrenceId, CancellationToken ct)
        => Run(member => safeguarding.GetWorkspaceAsync(eventId, occurrenceId, member, ct));

    [HttpGet("me")]
    public Task<IActionResult> GetMyContext(Guid eventId, CancellationToken ct)
        => Run(member => safeguarding.GetMyContextAsync(eventId, member, ct));

    [HttpPost("configuration")]
    public Task<IActionResult> ConfigurePolicy(Guid eventId, ConfigureEventSafeguardingRequest request, CancellationToken ct)
        => Run(member => safeguarding.ConfigurePolicyAsync(eventId, member, request, IfMatch(), IdempotencyKey(), ct));

    [HttpPost("children")]
    public Task<IActionResult> RegisterChild(Guid eventId, CreateEventChildRegistrationRequest request, CancellationToken ct)
        => Run(member => safeguarding.RegisterChildAsync(eventId, member, request, IdempotencyKey(), ct));

    [HttpPost("children/{childId:guid}/guardians")]
    public Task<IActionResult> AddGuardian(Guid eventId, Guid childId, CreateEventChildGuardianRequest request, CancellationToken ct)
        => Run(member => safeguarding.AddGuardianAsync(eventId, childId, member, request, IfMatch(), IdempotencyKey(), ct));

    [HttpPost("guardian-relationships/{relationshipId:guid}/confirm")]
    public Task<IActionResult> ConfirmGuardian(Guid eventId, Guid relationshipId, CancellationToken ct)
        => Run(member => safeguarding.ConfirmGuardianAsync(eventId, relationshipId, member, IfMatch(), IdempotencyKey(), ct));

    [HttpPost("guardian-relationships/{relationshipId:guid}/consent")]
    public Task<IActionResult> RecordConsent(Guid eventId, Guid relationshipId, RecordEventChildConsentRequest request, CancellationToken ct)
        => Run(member => safeguarding.RecordConsentAsync(eventId, relationshipId, member, request, IfMatch(), IdempotencyKey(), ct));

    [HttpPost("children/{childId:guid}/collectors")]
    public Task<IActionResult> AddCollector(Guid eventId, Guid childId, CreateEventChildCollectorRequest request, CancellationToken ct)
        => Run(member => safeguarding.AddCollectorAsync(eventId, childId, member, request, IdempotencyKey(), ct));

    [HttpPost("collectors/{collectorId:guid}/revoke")]
    public Task<IActionResult> RevokeCollector(Guid eventId, Guid collectorId, CancellationToken ct)
        => Run(member => safeguarding.RevokeCollectorAsync(eventId, collectorId, member, IfMatch(), IdempotencyKey(), ct));

    [HttpPost("workers/evidence")]
    public Task<IActionResult> SaveWorkerEvidence(Guid eventId, SaveEventSafeguardingWorkerEvidenceRequest request, CancellationToken ct)
        => Run(member => safeguarding.SaveWorkerEvidenceAsync(eventId, member, request, IdempotencyKey(), ct));

    [HttpPost("occurrences/{occurrenceId:guid}/children/{childId:guid}/check-in")]
    public Task<IActionResult> CheckIn(Guid eventId, Guid occurrenceId, Guid childId, CancellationToken ct)
        => Run(member => safeguarding.CheckInAsync(eventId, occurrenceId, childId, member, IfMatch(), IdempotencyKey(), ct));

    [HttpPost("occurrences/{occurrenceId:guid}/children/{childId:guid}/check-out")]
    public Task<IActionResult> CheckOut(Guid eventId, Guid occurrenceId, Guid childId, CheckOutEventChildRequest request, CancellationToken ct)
        => Run(member => safeguarding.CheckOutAsync(eventId, occurrenceId, childId, member, request, IfMatch(), IdempotencyKey(), ct));

    private string IfMatch() => Request.Headers.IfMatch.ToString();
    private string IdempotencyKey() => Request.Headers["Idempotency-Key"].ToString();

    private async Task<IActionResult> Run<T>(Func<Guid, Task<Alife.Application.Common.Models.AppResult<T>>> action)
    {
        this.ApplyNoStoreHeaders();
        Response.Headers.CacheControl = "private, no-store";
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await action(memberId.Value));
    }
}
