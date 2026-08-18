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
using Alife.Application.Events.Queries.GetEventWorkflow;
using Alife.Application.Events.Queries.ListEventWorkflowTemplates;
using Alife.Application.Events.Queries.ListPublicUpcomingEvents;
using Alife.Application.Events.Commands.InitializeEventWorkflow;
using Alife.Application.Events.Commands.CreateEventWorkflowTemplate;
using Alife.Application.Events.Commands.UpdateEventWorkflowStep;
using Alife.Application.Events.Commands.CreateEventArtifact;
using Alife.Application.Events.Commands.UpdateEventArtifact;
using Alife.Domain.Enums;
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
                request.WorkflowTemplateCode),
            cancellationToken);

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
                request.RamDataJson),
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
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new GetEventRamQuery(id, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}/ram")]
    public async Task<IActionResult> SaveRam(Guid id, [FromBody] SaveEventRamRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new SaveEventRamCommand(id, currentMemberId.Value, request.RamDataJson), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/ram/submit")]
    public async Task<IActionResult> SubmitRam(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new SubmitEventRamCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/ram/approve")]
    public async Task<IActionResult> ApproveRam(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new ApproveEventRamCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpGet("event-workflow-templates")]
    public async Task<IActionResult> ListWorkflowTemplates([FromQuery] Guid? groupId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new ListEventWorkflowTemplatesQuery(groupId, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/event-workflow-templates")]
    public async Task<IActionResult> CreateWorkflowTemplate(
        Guid groupId,
        [FromBody] CreateEventWorkflowTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new CreateEventWorkflowTemplateCommand(
            groupId,
            currentMemberId.Value,
            request.NameEn,
            request.NameZh,
            request.DescriptionEn,
            request.DescriptionZh,
            (request.Stages ?? []).Select(stage => new CreateEventWorkflowStageInput(
                stage.NameEn,
                stage.NameZh,
                stage.RequiresApproval)).ToArray()), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpGet("events/{id:guid}/workflow")]
    public async Task<IActionResult> GetWorkflow(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new GetEventWorkflowQuery(id, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/workflow")]
    public async Task<IActionResult> InitializeWorkflow(
        Guid id,
        [FromBody] InitializeEventWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(
            new InitializeEventWorkflowCommand(id, currentMemberId.Value, request.TemplateCode), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}/workflow/steps/{stepId:guid}")]
    public async Task<IActionResult> UpdateWorkflowStep(
        Guid id,
        Guid stepId,
        [FromBody] UpdateEventWorkflowStepRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new UpdateEventWorkflowStepCommand(
            id, stepId, currentMemberId.Value, request.Status, request.AssignedMemberId, request.DueUtc), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/workflow/artifacts")]
    public async Task<IActionResult> CreateWorkflowArtifact(
        Guid id,
        [FromBody] CreateEventArtifactRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new CreateEventArtifactCommand(
            id, currentMemberId.Value, request.WorkflowStepId, request.ArtifactType,
            request.TitleEn, request.TitleZh, request.IsRequired, request.Visibility,
            request.FileAssetId, request.DataJson), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}/workflow/artifacts/{artifactId:guid}")]
    public async Task<IActionResult> UpdateWorkflowArtifact(
        Guid id,
        Guid artifactId,
        [FromBody] UpdateEventArtifactRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new UpdateEventArtifactCommand(
            id, artifactId, currentMemberId.Value, request.TitleEn, request.TitleZh,
            request.Status, request.Visibility, request.FileAssetId, request.DataJson), cancellationToken);
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
        string? WorkflowTemplateCode);

    public record UpdateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson,
        IReadOnlyList<Guid>? ContactProfileIds,
        string? RamDataJson);

    public record SaveEventRamRequest(string RamDataJson);

    public record InitializeEventWorkflowRequest(string TemplateCode);

    public record CreateEventWorkflowTemplateRequest(
        string NameEn,
        string NameZh,
        string DescriptionEn,
        string DescriptionZh,
        IReadOnlyList<CreateEventWorkflowStageRequest>? Stages);

    public record CreateEventWorkflowStageRequest(
        string NameEn,
        string NameZh,
        bool RequiresApproval);

    public record UpdateEventWorkflowStepRequest(
        EventWorkflowStepStatus Status,
        Guid? AssignedMemberId,
        DateTime? DueUtc);

    public record CreateEventArtifactRequest(
        Guid? WorkflowStepId,
        string ArtifactType,
        string TitleEn,
        string TitleZh,
        bool IsRequired,
        FileAssetVisibility Visibility,
        Guid? FileAssetId,
        string DataJson);

    public record UpdateEventArtifactRequest(
        string TitleEn,
        string TitleZh,
        EventArtifactStatus Status,
        FileAssetVisibility Visibility,
        Guid? FileAssetId,
        string DataJson);
}
