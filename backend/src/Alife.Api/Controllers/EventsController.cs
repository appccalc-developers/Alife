using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Commands.DeleteGroupEvent;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Queries.GetGroupEvents;
using Alife.Application.Events.Queries.ListPublicUpcomingEvents;
using Alife.Domain.Enums;
using Alife.Application.Events.Services;
using System.Text.Json.Serialization;
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
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
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

        this.ApplyPrivateNoStoreHeaders();
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

        if (ValidateWriteComposition(request.Composition, request.CompositionProposalHash) is { } compositionError)
            return compositionError;
        var composition = request.Composition!.ToApplication();

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
                composition,
                request.CompositionProposalHash,
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

        if (ValidateWriteComposition(request.Composition, request.CompositionProposalHash,
                request.PlanETag, requirePlanETag: true) is { } compositionError)
            return compositionError;
        var composition = request.Composition!.ToApplication();

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
                composition,
                request.CompositionProposalHash,
                request.PlanETag,
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

    // Composition fields are nullable only at the JSON transport boundary so an omitted
    // schema can be mapped to the stable Event error code instead of ApiController's
    // generic model-state response. ValidateWriteComposition makes the complete tree
    // mandatory before any command is dispatched.
    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public record CreateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson,
        IReadOnlyList<Guid>? ContactProfileIds,
        string? RamDataJson,
        EventWriteCompositionRequest? Composition,
        string? CompositionProposalHash,
        EventGovernanceMode? GovernanceMode = null,
        Guid? ParentEventId = null,
        Alife.Application.Events.Dtos.CreateEventSeriesSetupRequest? SeriesSetup = null,
        Alife.Application.Events.Dtos.EventCreationArrangementsRequest? Arrangements = null);

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public record UpdateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson,
        IReadOnlyList<Guid>? ContactProfileIds,
        EventWriteCompositionRequest? Composition,
        string? CompositionProposalHash,
        string? PlanETag,
        Alife.Application.Events.Dtos.PreparationSeriesUpdate? SeriesUpdate = null);

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public sealed record EventWriteCompositionRequest(
        string? SchemaVersion,
        EventFactSetInput? Facts,
        IReadOnlyList<ModuleSelectionInput>? HumanSelections,
        IReadOnlyDictionary<string, bool>? ModuleConfirmations,
        ActivityPlanData? ActivityPlan,
        string? ArchetypeCode = null,
        int? BasePlanVersion = null,
        string? ActivityTypeCode = null,
        bool UseRecommendedWorkflow = false,
        int? ActivityTypeVersion = null,
        IReadOnlyList<string>? RemovedPresetKeys = null)
    {
        public EventPlanComposeRequest ToApplication() => new(
            SchemaVersion!,
            ArchetypeCode,
            Facts!,
            HumanSelections!,
            BasePlanVersion,
            ActivityTypeCode,
            UseRecommendedWorkflow,
            ModuleConfirmations,
            ActivityPlan,
            ActivityTypeVersion,
            RemovedPresetKeys);
    }

    private BadRequestObjectResult? ValidateWriteComposition(
        EventWriteCompositionRequest? request,
        string? proposalHash,
        string? planETag = null,
        bool requirePlanETag = false)
    {
        if (request is null || !EventCompositionDefinitions.IsSupportedSchema(request.SchemaVersion ?? string.Empty))
            return BadRequest(new
            {
                code = EventCompositionDefinitions.UnsupportedSchemaErrorCode,
                message = $"schemaVersion must be {EventCompositionDefinitions.SchemaVersion}."
            });

        var composition = request.ToApplication();
        var error = EventCompositionRequestContract.ValidateComplete(composition);
        if (error is not null || string.IsNullOrWhiteSpace(proposalHash) ||
            requirePlanETag && (string.IsNullOrWhiteSpace(planETag) || !composition.BasePlanVersion.HasValue))
            return BadRequest(new
            {
                code = EventCompositionRequestContract.InvalidCompositionErrorCode,
                message = error ?? (!requirePlanETag
                    ? "compositionProposalHash is required for Event creation."
                    : "compositionProposalHash, planETag and composition.basePlanVersion are required for an Event detail update.")
            });
        return null;
    }

}
