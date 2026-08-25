using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Rosters;
using Alife.Application.Rosters.Commands;
using Alife.Application.Rosters.Capabilities;
using Alife.Application.Rosters.Profiles;
using Alife.Application.Rosters.Queries;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class RostersController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("groups/{groupId:guid}/scheduling-profile")]
    public async Task<IActionResult> GetSelfProfile(Guid groupId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetSelfSchedulingProfileQuery(groupId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("groups/{groupId:guid}/scheduling-profile")]
    public async Task<IActionResult> SaveSelfProfile(Guid groupId, [FromBody] SaveSelfSchedulingProfileRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveSelfSchedulingProfileCommand(
            groupId, memberId.Value, request.PreferredRoleKeys, request.UnavailableWindows,
            request.MaxAssignmentsPerDay, request.SelfNotes), cancellationToken));
    }

    [HttpPut("groups/{groupId:guid}/scheduling-profiles/{targetMemberId:guid}/manager")]
    public async Task<IActionResult> SaveManagerLabels(Guid groupId, Guid targetMemberId, [FromBody] SaveManagerSchedulingLabelsRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveManagerSchedulingLabelsCommand(
            groupId, targetMemberId, memberId.Value, request.ManagerLabels, request.ManagerNotes,
            request.UnavailableWindows, request.ConfirmationStatus, request.ConfirmationMethod, request.ReviewDueUtc,
            request.Qualifications), cancellationToken));
    }

    [HttpGet("events/{eventId:guid}/roster")]
    public async Task<IActionResult> GetWorkspace(Guid eventId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventRosterWorkspaceQuery(eventId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("events/{eventId:guid}/roster/my-assignments")]
    public async Task<IActionResult> GetMyAssignments(Guid eventId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetMyEventRosterQuery(eventId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("events/{eventId:guid}/roster/shifts")]
    public Task<IActionResult> CreateShift(Guid eventId, [FromBody] SaveRosterShiftRequest request, CancellationToken cancellationToken) =>
        SaveShift(eventId, null, request, cancellationToken);

    [HttpPut("events/{eventId:guid}/roster/shifts/{shiftId:guid}")]
    public Task<IActionResult> UpdateShift(Guid eventId, Guid shiftId, [FromBody] SaveRosterShiftRequest request, CancellationToken cancellationToken) =>
        SaveShift(eventId, shiftId, request, cancellationToken);

    [HttpGet("events/{eventId:guid}/roster/shifts/{shiftId:guid}/suggestions")]
    public async Task<IActionResult> Suggestions(Guid eventId, Guid shiftId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetRosterSuggestionsQuery(eventId, shiftId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("groups/{groupId:guid}/roster-capabilities")]
    public async Task<IActionResult> ListCapabilities(Guid groupId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new ListRosterCapabilitiesQuery(groupId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/roster-capabilities")]
    public Task<IActionResult> CreateCapability(Guid groupId, [FromBody] SaveRosterCapabilityRequest request, CancellationToken cancellationToken) =>
        SaveCapability(groupId, null, request, cancellationToken);

    [HttpPut("groups/{groupId:guid}/roster-capabilities/{capabilityId:guid}")]
    public Task<IActionResult> UpdateCapability(Guid groupId, Guid capabilityId, [FromBody] SaveRosterCapabilityRequest request, CancellationToken cancellationToken) =>
        SaveCapability(groupId, capabilityId, request, cancellationToken);

    [HttpGet("events/{eventId:guid}/roster/plan-options")]
    public async Task<IActionResult> PlanOptions(Guid eventId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventRosterPlanOptionsQuery(eventId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("events/{eventId:guid}/roster/shifts/{shiftId:guid}/assignments")]
    public async Task<IActionResult> ConfirmAssignment(Guid eventId, Guid shiftId, [FromBody] ConfirmRosterAssignmentRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new ConfirmRosterAssignmentCommand(
            eventId, shiftId, request.MemberId, memberId.Value, request.BasedOnSmartSuggestion, request.ConfirmationNotes), cancellationToken));
    }

    [HttpPost("events/{eventId:guid}/roster/assignments/{assignmentId:guid}/cancel")]
    public async Task<IActionResult> CancelAssignment(Guid eventId, Guid assignmentId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new CancelRosterAssignmentCommand(eventId, assignmentId, memberId.Value), cancellationToken));
    }

    [HttpPost("events/{eventId:guid}/roster/assignments/{assignmentId:guid}/response")]
    public async Task<IActionResult> RespondAssignment(
        Guid eventId, Guid assignmentId, [FromBody] RespondRosterAssignmentRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new RespondRosterAssignmentCommand(
            eventId, assignmentId, memberId.Value, request.Response, request.Notes), cancellationToken));
    }

    private async Task<IActionResult> SaveShift(Guid eventId, Guid? shiftId, SaveRosterShiftRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveRosterShiftCommand(
            eventId, shiftId, memberId.Value, request.RoleKey, request.NameEn, request.NameZh,
            request.StartUtc, request.EndUtc, request.RequiredPeople, request.RequiredLabels, request.Notes), cancellationToken));
    }

    private async Task<IActionResult> SaveCapability(Guid groupId, Guid? capabilityId, SaveRosterCapabilityRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveRosterCapabilityCommand(
            groupId, capabilityId, memberId.Value, request.Key, request.NameEn, request.NameZh,
            request.DescriptionEn, request.DescriptionZh, request.RequiresExpiry,
            request.DefaultValidityDays, request.IsActive), cancellationToken));
    }

    public sealed record SaveSelfSchedulingProfileRequest(
        IReadOnlyList<string>? PreferredRoleKeys,
        IReadOnlyList<SchedulingUnavailableWindowDto>? UnavailableWindows,
        int MaxAssignmentsPerDay,
        string? SelfNotes);
    public sealed record SaveManagerSchedulingLabelsRequest(
        IReadOnlyList<string>? ManagerLabels,
        string? ManagerNotes,
        IReadOnlyList<SchedulingUnavailableWindowDto>? UnavailableWindows = null,
        string ConfirmationStatus = "confirmed",
        string ConfirmationMethod = "inPerson",
        DateTime? ReviewDueUtc = null,
        IReadOnlyList<ManagerQualificationDto>? Qualifications = null);
    public sealed record SaveRosterShiftRequest(
        string RoleKey, string NameEn, string NameZh, DateTime StartUtc, DateTime EndUtc,
        int RequiredPeople, IReadOnlyList<string>? RequiredLabels, string? Notes);
    public sealed record ConfirmRosterAssignmentRequest(Guid MemberId, bool BasedOnSmartSuggestion, string? ConfirmationNotes);
    public sealed record RespondRosterAssignmentRequest(EventRosterMemberResponse Response, string? Notes);
    public sealed record SaveRosterCapabilityRequest(
        string Key, string NameEn, string NameZh, string DescriptionEn, string DescriptionZh,
        bool RequiresExpiry, int? DefaultValidityDays, bool IsActive);
}
