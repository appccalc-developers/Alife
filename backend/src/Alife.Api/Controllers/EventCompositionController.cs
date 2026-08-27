using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class EventCompositionController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("event-archetypes")]
    public async Task<IActionResult> ListArchetypes(
        [FromQuery] Guid? groupId,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new ListEventArchetypesQuery(memberId.Value, groupId), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/event-plans/compose")]
    public async Task<IActionResult> Compose(
        Guid groupId,
        [FromBody] EventPlanComposeRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(
            new ComposeEventPlanCommand(groupId, memberId.Value, request), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("events/{id:guid}/plan")]
    public async Task<IActionResult> GetPlan(Guid id, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventPlanQuery(id, memberId.Value), cancellationToken);
        this.ApplyNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/plan/recompose")]
    public async Task<IActionResult> Recompose(
        Guid id,
        [FromBody] EventPlanComposeRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new RecomposeEventPlanCommand(
            id, memberId.Value, request, Request.Headers.IfMatch.ToString()), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/plan/accept")]
    public async Task<IActionResult> AcceptPlan(
        Guid id,
        [FromBody] AcceptEventPlanRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new AcceptEventPlanCommand(
            id,
            memberId.Value,
            request,
            Request.Headers.IfMatch.ToString(),
            Request.Headers["Idempotency-Key"].ToString()), cancellationToken);
        this.ApplyNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }

    [HttpGet("events/{id:guid}/workspace")]
    public async Task<IActionResult> GetWorkspace(Guid id, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventWorkspaceQuery(id, memberId.Value), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("groups/{groupId:guid}/event-series")]
    public async Task<IActionResult> ListSeries(Guid groupId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new ListEventSeriesQuery(groupId, memberId.Value), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/event-series")]
    public async Task<IActionResult> CreateSeries(
        Guid groupId,
        [FromBody] CreateEventSeriesRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new CreateEventSeriesCommand(
            groupId, memberId.Value, request, Request.Headers["Idempotency-Key"].ToString()), cancellationToken);
        this.ApplyNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }

    [HttpGet("event-series/{seriesId:guid}")]
    public async Task<IActionResult> GetSeries(Guid seriesId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventSeriesQuery(seriesId, memberId.Value), cancellationToken);
        this.ApplyNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }

    [HttpPut("event-series/{seriesId:guid}")]
    public async Task<IActionResult> UpdateSeries(
        Guid seriesId,
        [FromBody] UpdateEventSeriesRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new UpdateEventSeriesCommand(
            seriesId, memberId.Value, request, Request.Headers.IfMatch.ToString()), cancellationToken);
        this.ApplyNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }

    [HttpGet("event-series/{seriesId:guid}/occurrences")]
    public async Task<IActionResult> ListOccurrences(
        Guid seriesId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(
            new ListEventSeriesOccurrencesQuery(seriesId, memberId.Value, from, to), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("events/{id:guid}/role-assignments")]
    public async Task<IActionResult> ListRoleAssignments(Guid id, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new ListEventRoleAssignmentsQuery(id, memberId.Value), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/role-assignments")]
    public async Task<IActionResult> CreateRoleAssignment(
        Guid id,
        [FromBody] CreateEventRoleAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new CreateEventRoleAssignmentCommand(
            id, memberId.Value, request, Request.Headers["Idempotency-Key"].ToString()), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpDelete("events/{id:guid}/role-assignments/{assignmentId:guid}")]
    public async Task<IActionResult> EndRoleAssignment(
        Guid id,
        Guid assignmentId,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(
            new EndEventRoleAssignmentCommand(id, assignmentId, memberId.Value), cancellationToken);
        this.ApplyNoStoreHeaders();
        return result.IsSuccess ? NoContent() : this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/role-assignments/{assignmentId:guid}/accept")]
    public async Task<IActionResult> AcceptRoleAssignment(Guid id, Guid assignmentId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new RespondToEventRoleAssignmentCommand(id, assignmentId, memberId.Value, true), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/role-assignments/{assignmentId:guid}/decline")]
    public async Task<IActionResult> DeclineRoleAssignment(Guid id, Guid assignmentId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new RespondToEventRoleAssignmentCommand(id, assignmentId, memberId.Value, false), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/sponsorship/submit")]
    public async Task<IActionResult> SubmitSponsorship(
        Guid id,
        [FromBody] SponsorshipSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new SubmitEventSponsorshipCommand(
            id, memberId.Value, request, Request.Headers["Idempotency-Key"].ToString()), cancellationToken);
        this.ApplyNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/sponsorship/approve")]
    public Task<IActionResult> ApproveSponsorship(
        Guid id,
        [FromBody] SponsorshipDecisionRequest request,
        CancellationToken cancellationToken)
        => DecideSponsorship(id, request, EventApprovalDecisionType.Approved, cancellationToken);

    [HttpPost("events/{id:guid}/sponsorship/reject")]
    public Task<IActionResult> RejectSponsorship(
        Guid id,
        [FromBody] SponsorshipDecisionRequest request,
        CancellationToken cancellationToken)
        => DecideSponsorship(id, request, EventApprovalDecisionType.Rejected, cancellationToken);

    private async Task<IActionResult> DecideSponsorship(
        Guid id,
        SponsorshipDecisionRequest request,
        EventApprovalDecisionType decision,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new DecideEventSponsorshipCommand(
            id,
            memberId.Value,
            request,
            decision,
            Request.Headers.IfMatch.ToString(),
            Request.Headers["Idempotency-Key"].ToString()), cancellationToken);
        this.ApplyNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }
}
