using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Commands.DeleteGroupEvent;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Commands.SaveEventRam;
using Alife.Application.Events.Commands.SubmitEventRam;
using Alife.Application.Events.Commands.ApproveEventRam;
using Alife.Application.Events.Commands.ReturnEventRam;
using Alife.Application.Events.Commands.UpdateEventRegistrationSettings;
using Alife.Application.Events.Commands.UpdateEventFinanceSettings;
using Alife.Application.Events.Commands.UpdateEventOccurrences;
using Alife.Application.Events.Commands.SaveEventAttendanceRecord;
using Alife.Application.Events.Commands.SaveEventFinanceEntry;
using Alife.Application.Events.Commands.DeleteEventFinanceEntry;
using Alife.Application.Events.Commands.ReconcileEventFinance;
using Alife.Application.Events.Queries.GetGroupEvents;
using Alife.Application.Events.Queries.GetEventRam;
using Alife.Application.Events.Queries.GetEventWorkflow;
using Alife.Application.Events.Queries.GetEventPlan;
using Alife.Application.Events.Queries.GetEventRegistrationWorkspace;
using Alife.Application.Events.Queries.GetEventFinanceWorkspace;
using Alife.Application.Events.Queries.GetEventAttendanceWorkspace;
using Alife.Application.Events.Queries.ListPublicUpcomingEvents;
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
                request.WorkflowTemplateCode,
                request.AiAssistanceReviewed),
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
                request.RamDataJson,
                AiAssistanceReviewed: request.AiAssistanceReviewed),
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
    public async Task<IActionResult> ApproveRam(Guid id, [FromBody] ReviewEventRamRequest? request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new ApproveEventRamCommand(id, currentMemberId.Value, request?.DecisionNotes ?? string.Empty), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpGet("events/{id:guid}/registration")]
    public async Task<IActionResult> GetRegistrationWorkspace(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new GetEventRegistrationWorkspaceQuery(id, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}/registration")]
    public async Task<IActionResult> UpdateRegistrationSettings(
        Guid id,
        [FromBody] UpdateEventRegistrationSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new UpdateEventRegistrationSettingsCommand(
            id,
            currentMemberId.Value,
            request.MaxCapacity,
            request.CapacityUnit,
            request.RegistrationDeadlineUtc), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpGet("events/{id:guid}/finance")]
    public async Task<IActionResult> GetFinanceWorkspace(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new GetEventFinanceWorkspaceQuery(id, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}/finance")]
    public async Task<IActionResult> UpdateFinanceSettings(Guid id, [FromBody] UpdateEventFinanceSettingsRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new UpdateEventFinanceSettingsCommand(
            id, currentMemberId.Value, request.Enabled, request.Currency, request.AdultFee, request.ChildFee,
            request.PaymentInstructionsEn, request.PaymentInstructionsZh, request.RefundPolicyEn, request.RefundPolicyZh,
            request.PaymentEvidenceRequired, request.LeaderConfirmed,
            request.Options?.Select(x => new UpdateEventFinanceOptionInput(x.Id, x.NameEn, x.NameZh, x.ExtraFee)).ToArray() ?? []), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/finance/entries")]
    public async Task<IActionResult> CreateFinanceEntry(Guid id, [FromBody] SaveEventFinanceEntryRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveEventFinanceEntryCommand(
            id, null, currentMemberId.Value, request.Type, request.Category,
            request.DescriptionEn, request.DescriptionZh, request.Amount, request.OccurredUtc), cancellationToken));
    }

    [HttpPut("events/{id:guid}/finance/entries/{entryId:guid}")]
    public async Task<IActionResult> UpdateFinanceEntry(Guid id, Guid entryId, [FromBody] SaveEventFinanceEntryRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveEventFinanceEntryCommand(
            id, entryId, currentMemberId.Value, request.Type, request.Category,
            request.DescriptionEn, request.DescriptionZh, request.Amount, request.OccurredUtc), cancellationToken));
    }

    [HttpDelete("events/{id:guid}/finance/entries/{entryId:guid}")]
    public async Task<IActionResult> DeleteFinanceEntry(Guid id, Guid entryId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new DeleteEventFinanceEntryCommand(id, entryId, currentMemberId.Value), cancellationToken));
    }

    [HttpPut("events/{id:guid}/finance/reconciliation")]
    public async Task<IActionResult> ReconcileFinance(Guid id, [FromBody] ReconcileEventFinanceRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new ReconcileEventFinanceCommand(
            id, currentMemberId.Value, request.NotesEn, request.NotesZh, request.LeaderConfirmed), cancellationToken));
    }

    [HttpGet("events/{id:guid}/attendance")]
    public async Task<IActionResult> GetAttendanceWorkspace(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new GetEventAttendanceWorkspaceQuery(id, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}/attendance/records")]
    public async Task<IActionResult> SaveAttendanceRecord(Guid id, [FromBody] SaveEventAttendanceRecordRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveEventAttendanceRecordCommand(
            id, currentMemberId.Value, request.EventOccurrenceId, request.EventEnrollmentId,
            request.AttendedUnits, request.Notes), cancellationToken));
    }

    [HttpPost("events/{id:guid}/ram/return")]
    public async Task<IActionResult> ReturnRam(Guid id, [FromBody] ReviewEventRamRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new ReturnEventRamCommand(id, currentMemberId.Value, request.DecisionNotes ?? string.Empty), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpGet("event-workflow-templates")]
    public IActionResult ListWorkflowTemplates([FromQuery] Guid? groupId, CancellationToken cancellationToken)
    {
        return LegacyWorkflowRetired();
    }

    [HttpPost("groups/{groupId:guid}/event-workflow-templates")]
    public IActionResult CreateWorkflowTemplate(
        Guid groupId,
        [FromBody] CreateEventWorkflowTemplateRequest request,
        CancellationToken cancellationToken)
    {
        return LegacyWorkflowRetired();
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

    [HttpGet("events/{id:guid}/plan")]
    public async Task<IActionResult> GetPlan(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new GetEventPlanQuery(id, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("events/{id:guid}/occurrences")]
    public async Task<IActionResult> UpdateOccurrences(
        Guid id,
        [FromBody] UpdateEventOccurrencesRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new UpdateEventOccurrencesCommand(
            id,
            currentMemberId.Value,
            request.Occurrences?.Select(x => new UpdateEventOccurrenceInput(
                x.Id, x.NameEn, x.NameZh, x.StartUtc, x.EndUtc, x.TimeZoneId)).ToArray() ?? []),
            cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("events/{id:guid}/workflow")]
    public IActionResult InitializeWorkflow(
        Guid id,
        [FromBody] InitializeEventWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        return LegacyWorkflowRetired();
    }

    [HttpPut("events/{id:guid}/workflow/steps/{stepId:guid}")]
    public IActionResult UpdateWorkflowStep(
        Guid id,
        Guid stepId,
        [FromBody] UpdateEventWorkflowStepRequest request,
        CancellationToken cancellationToken)
    {
        return LegacyWorkflowRetired();
    }

    [HttpPost("events/{id:guid}/workflow/artifacts")]
    public IActionResult CreateWorkflowArtifact(
        Guid id,
        [FromBody] CreateEventArtifactRequest request,
        CancellationToken cancellationToken)
    {
        return LegacyWorkflowRetired();
    }

    [HttpPut("events/{id:guid}/workflow/artifacts/{artifactId:guid}")]
    public IActionResult UpdateWorkflowArtifact(
        Guid id,
        Guid artifactId,
        [FromBody] UpdateEventArtifactRequest request,
        CancellationToken cancellationToken)
    {
        return LegacyWorkflowRetired();
    }

    public record CreateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson,
        IReadOnlyList<Guid>? ContactProfileIds,
        string? RamDataJson,
        string? WorkflowTemplateCode,
        bool AiAssistanceReviewed = false);

    public record UpdateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson,
        IReadOnlyList<Guid>? ContactProfileIds,
        string? RamDataJson,
        bool AiAssistanceReviewed = false);

    public record SaveEventRamRequest(string RamDataJson);

    public record ReviewEventRamRequest(string? DecisionNotes);

    public record UpdateEventRegistrationSettingsRequest(
        int MaxCapacity,
        string CapacityUnit,
        DateTime? RegistrationDeadlineUtc);

    public record UpdateEventFinanceOptionRequest(string? Id, string NameEn, string NameZh, decimal ExtraFee);
    public record UpdateEventFinanceSettingsRequest(
        bool Enabled, string Currency, decimal? AdultFee, decimal? ChildFee,
        string PaymentInstructionsEn, string PaymentInstructionsZh,
        string RefundPolicyEn, string RefundPolicyZh,
        bool PaymentEvidenceRequired, bool LeaderConfirmed,
        IReadOnlyList<UpdateEventFinanceOptionRequest>? Options);

    public record SaveEventFinanceEntryRequest(
        EventFinanceEntryType Type,
        string Category,
        string DescriptionEn,
        string DescriptionZh,
        decimal Amount,
        DateTime OccurredUtc);

    public record ReconcileEventFinanceRequest(string NotesEn, string NotesZh, bool LeaderConfirmed);

    public record SaveEventAttendanceRecordRequest(
        Guid EventOccurrenceId,
        Guid? EventEnrollmentId,
        int AttendedUnits,
        string Notes);

    public record UpdateEventOccurrenceRequest(
        Guid? Id,
        string NameEn,
        string NameZh,
        DateTime StartUtc,
        DateTime EndUtc,
        string TimeZoneId);

    public record UpdateEventOccurrencesRequest(IReadOnlyList<UpdateEventOccurrenceRequest>? Occurrences);

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

    private ObjectResult LegacyWorkflowRetired() => StatusCode(
        StatusCodes.Status410Gone,
        new ProblemDetails
        {
            Status = StatusCodes.Status410Gone,
            Title = "The fixed event workflow has been retired.",
            Detail = "All events now use the composed preparation plan. Historical workflow data remains read-only; use the event plan and its modules for current work."
        });
}
