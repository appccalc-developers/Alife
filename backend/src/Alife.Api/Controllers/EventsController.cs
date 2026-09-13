using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Commands.DeleteGroupEvent;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Commands.SaveEventRam;
using Alife.Application.Events.Commands.SubmitEventRam;
using Alife.Application.Events.Commands.ApproveEventRam;
using Alife.Application.Events.Queries.GetGroupEvents;
using Alife.Application.Events.Queries.GetEventRam;
using Alife.Application.Events.Queries.ListPublicUpcomingEvents;
using Alife.Domain.Enums;
using Alife.Application.Events.Services;
using Alife.Application.Events.Dtos;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class EventsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor,
    EventRamGovernanceService ramGovernance) : ControllerBase
{
    [HttpGet("events/public/upcoming")]
    [AllowAnonymous]
    public async Task<IActionResult> PublicUpcomingEvents([FromQuery] int limit = 50, CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new ListPublicUpcomingEventsQuery(limit), cancellationToken);
        this.ApplyPublicCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("groups/{groupId:guid}/events")]
    [AllowAnonymous]
    public async Task<IActionResult> GroupEvents(Guid groupId, CancellationToken cancellationToken = default)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();

        var result = await mediator.Send(new GetGroupEventsQuery(groupId, currentMemberId), cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/events")]
    public async Task<IActionResult> CreateGroupEvent(Guid groupId, [FromBody] CreateGroupEventRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new CreateGroupEventCommand(
                groupId,
                currentMemberId.Value,
                request.TitleEn,
                request.TitleZh,
                request.StartDate,
                request.EndDate,
                request.EventDataJson,
                request.ContactProfileIds ?? [],
                request.RamDataJson,
                request.Composition,
                request.CompositionProposalHash,
                request.AccountableOwnerMemberId,
                request.GovernanceMode,
                request.ParentEventId,
                Request.Headers["Idempotency-Key"].FirstOrDefault(),
                request.SeriesSetup,
                request.Arrangements),
            cancellationToken);

        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}")]
    public async Task<IActionResult> UpdateEvent(Guid id, [FromBody] UpdateGroupEventRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdateGroupEventCommand(
                id,
                currentMemberId.Value,
                request.TitleEn,
                request.TitleZh,
                request.StartDate,
                request.EndDate,
                request.EventDataJson,
                request.ContactProfileIds ?? [],
                request.RamDataJson,
                Request.Headers.IfMatch.FirstOrDefault(), request.SeriesUpdate),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpDelete("events/{id:guid}")]
    public async Task<IActionResult> DeleteEvent(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new DeleteGroupEventCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpGet("events/{id:guid}/ram")]
    public async Task<IActionResult> GetRam(Guid id, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new GetEventRamQuery(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}/ram")]
    public async Task<IActionResult> SaveRam(Guid id, [FromBody] SaveEventRamRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        if (request.SchemaVersion == 2)
            return this.ToActionResult(await ramGovernance.SaveAsync(id, currentMemberId.Value,
                new(request.RamDataJson, request.PolicyVersionId, request.ExpectedETag ?? ""), cancellationToken));
        var result = await mediator.Send(new SaveEventRamCommand(id, currentMemberId.Value, request.RamDataJson), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/ram/submit")]
    public async Task<IActionResult> SubmitRam(Guid id, CancellationToken cancellationToken,
        [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] RamActionRequest? request = null)
    {
        this.ApplyPrivateNoStoreHeaders();
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        if (request is not null) return this.ToActionResult(await ramGovernance.ActAsync(id,currentMemberId.Value,"submit",request,Request.Headers["Idempotency-Key"].ToString(),cancellationToken));
        var result = await mediator.Send(new SubmitEventRamCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/ram/approve")]
    public async Task<IActionResult> ApproveRam(Guid id, CancellationToken cancellationToken,
        [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] RamActionRequest? request = null)
    {
        this.ApplyPrivateNoStoreHeaders();
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        if (request is not null) return this.ToActionResult(await ramGovernance.ActAsync(id,currentMemberId.Value,"approve",request,Request.Headers["Idempotency-Key"].ToString(),cancellationToken));
        var result = await mediator.Send(new ApproveEventRamCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    public record CreateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson,
        IReadOnlyList<Guid>? ContactProfileIds,
        string? RamDataJson,
        Alife.Application.Events.Dtos.EventPlanComposeRequest? Composition = null,
        string? CompositionProposalHash = null,
        Guid? AccountableOwnerMemberId = null,
        EventGovernanceMode? GovernanceMode = null,
        Guid? ParentEventId = null,
        Alife.Application.Events.Dtos.CreateEventSeriesSetupRequest? SeriesSetup = null,
        Alife.Application.Events.Dtos.EventCreationArrangementsRequest? Arrangements = null);

    public record UpdateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson,
        IReadOnlyList<Guid>? ContactProfileIds,
        string? RamDataJson,
        Alife.Application.Events.Dtos.PreparationSeriesUpdate? SeriesUpdate = null);

    public record SaveEventRamRequest(string RamDataJson, int SchemaVersion = 1, Guid? PolicyVersionId = null, string? ExpectedETag = null);

}
