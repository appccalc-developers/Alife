using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}")]
[Authorize]
public sealed class EventOperationsController(
    IEventOperationsService operations,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("occurrences")]
    public Task<IActionResult> ListOccurrences(Guid eventId, CancellationToken ct)
        => Run(member => operations.ListOccurrencesAsync(eventId, member, ct));

    [HttpGet("team")]
    public Task<IActionResult> GetTeam(Guid eventId, CancellationToken ct) => Run(member => operations.GetTeamAsync(eventId, member, ct));

    [HttpPost("team/members")]
    public Task<IActionResult> InviteTeamMember(Guid eventId, InviteEventTeamMemberRequest request, CancellationToken ct)
        => Run(member => operations.InviteTeamMemberAsync(eventId, member, request, ct));

    [HttpPost("team/members/{teamMemberId:guid}/accept")]
    public Task<IActionResult> AcceptTeamInvite(Guid eventId, Guid teamMemberId, CancellationToken ct)
        => Run(member => operations.RespondToTeamInviteAsync(eventId, teamMemberId, member, true, ct));

    [HttpPost("team/members/{teamMemberId:guid}/decline")]
    public Task<IActionResult> DeclineTeamInvite(Guid eventId, Guid teamMemberId, CancellationToken ct)
        => Run(member => operations.RespondToTeamInviteAsync(eventId, teamMemberId, member, false, ct));

    [HttpDelete("team/members/{teamMemberId:guid}")]
    public Task<IActionResult> EndTeamMember(Guid eventId, Guid teamMemberId, CancellationToken ct)
        => Run(member => operations.EndTeamMemberAsync(eventId, teamMemberId, member, ct));

    [HttpPost("tasks")]
    public Task<IActionResult> CreateTask(Guid eventId, CreateEventTaskRequest request, CancellationToken ct)
        => Run(member => operations.CreateTaskAsync(eventId, member, request, ct), value => value.ETag);

    [HttpPut("tasks/{taskId:guid}")]
    public Task<IActionResult> UpdateTask(Guid eventId, Guid taskId, UpdateEventTaskRequest request, CancellationToken ct)
        => Run(member => operations.UpdateTaskAsync(eventId, taskId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpDelete("tasks/{taskId:guid}")]
    public Task<IActionResult> CancelTask(Guid eventId, Guid taskId, CancellationToken ct)
        => Run(member => operations.CancelTaskAsync(eventId, taskId, member, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpPost("tasks/{taskId:guid}/dependencies")]
    public Task<IActionResult> AddTaskDependency(Guid eventId, Guid taskId, AddEventTaskDependencyRequest request, CancellationToken ct)
        => Run(member => operations.AddTaskDependencyAsync(eventId, taskId, member, request, ct), value => value.ETag);

    [HttpDelete("tasks/{taskId:guid}/dependencies/{dependencyId:guid}")]
    public Task<IActionResult> RemoveTaskDependency(Guid eventId, Guid taskId, Guid dependencyId, CancellationToken ct)
        => Run(member => operations.RemoveTaskDependencyAsync(eventId, taskId, dependencyId, member, ct), value => value.ETag);

    [HttpPost("tasks/{taskId:guid}/blockers")]
    public Task<IActionResult> AddTaskBlocker(Guid eventId, Guid taskId, AddEventTaskBlockerRequest request, CancellationToken ct)
        => Run(member => operations.AddTaskBlockerAsync(eventId, taskId, member, request, ct), value => value.ETag);

    [HttpPost("tasks/{taskId:guid}/blockers/{blockerId:guid}/resolve")]
    public Task<IActionResult> ResolveTaskBlocker(Guid eventId, Guid taskId, Guid blockerId, ResolveEventTaskBlockerRequest request, CancellationToken ct)
        => Run(member => operations.ResolveTaskBlockerAsync(eventId, taskId, blockerId, member, request, ct), value => value.ETag);

    [HttpGet("occurrences/{occurrenceId:guid}/programme")]
    public Task<IActionResult> GetProgramme(Guid eventId, Guid occurrenceId, CancellationToken ct)
        => Run(member => operations.GetProgrammeAsync(eventId, occurrenceId, member, ct), value => value.ETag);

    [HttpPost("occurrences/{occurrenceId:guid}/programme/sessions")]
    public Task<IActionResult> CreateSession(Guid eventId, Guid occurrenceId, SaveEventSessionRequest request, CancellationToken ct)
        => Run(member => operations.CreateSessionAsync(eventId, occurrenceId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpPut("occurrences/{occurrenceId:guid}/programme/sessions/{sessionId:guid}")]
    public Task<IActionResult> UpdateSession(Guid eventId, Guid occurrenceId, Guid sessionId, SaveEventSessionRequest request, CancellationToken ct)
        => Run(member => operations.UpdateSessionAsync(eventId, occurrenceId, sessionId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpDelete("occurrences/{occurrenceId:guid}/programme/sessions/{sessionId:guid}")]
    public Task<IActionResult> DeleteSession(Guid eventId, Guid occurrenceId, Guid sessionId, CancellationToken ct)
        => Run(member => operations.DeleteSessionAsync(eventId, occurrenceId, sessionId, member, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpPost("occurrences/{occurrenceId:guid}/programme/sessions/{sessionId:guid}/items")]
    public Task<IActionResult> CreateProgramItem(Guid eventId, Guid occurrenceId, Guid sessionId, SaveEventProgramItemRequest request, CancellationToken ct)
        => Run(member => operations.CreateProgramItemAsync(eventId, occurrenceId, sessionId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpPut("occurrences/{occurrenceId:guid}/programme/items/{itemId:guid}")]
    public Task<IActionResult> UpdateProgramItem(Guid eventId, Guid occurrenceId, Guid itemId, SaveEventProgramItemRequest request, CancellationToken ct)
        => Run(member => operations.UpdateProgramItemAsync(eventId, occurrenceId, itemId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpDelete("occurrences/{occurrenceId:guid}/programme/items/{itemId:guid}")]
    public Task<IActionResult> DeleteProgramItem(Guid eventId, Guid occurrenceId, Guid itemId, CancellationToken ct)
        => Run(member => operations.DeleteProgramItemAsync(eventId, occurrenceId, itemId, member, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpPost("occurrences/{occurrenceId:guid}/programme/sessions/{sessionId:guid}/reorder")]
    public Task<IActionResult> ReorderProgramItems(Guid eventId, Guid occurrenceId, Guid sessionId, ReorderEventProgramItemsRequest request, CancellationToken ct)
        => Run(member => operations.ReorderProgramItemsAsync(eventId, occurrenceId, sessionId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpGet("occurrences/{occurrenceId:guid}/roster")]
    public Task<IActionResult> GetRoster(Guid eventId, Guid occurrenceId, CancellationToken ct)
        => Run(member => operations.GetRosterAsync(eventId, occurrenceId, member, ct), value => value.ETag);

    [HttpPost("occurrences/{occurrenceId:guid}/roster/slots")]
    public Task<IActionResult> CreateSlot(Guid eventId, Guid occurrenceId, SaveEventServiceSlotRequest request, CancellationToken ct)
        => Run(member => operations.CreateSlotAsync(eventId, occurrenceId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpPut("occurrences/{occurrenceId:guid}/roster/slots/{slotId:guid}")]
    public Task<IActionResult> UpdateSlot(Guid eventId, Guid occurrenceId, Guid slotId, SaveEventServiceSlotRequest request, CancellationToken ct)
        => Run(member => operations.UpdateSlotAsync(eventId, occurrenceId, slotId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpDelete("occurrences/{occurrenceId:guid}/roster/slots/{slotId:guid}")]
    public Task<IActionResult> DeleteSlot(Guid eventId, Guid occurrenceId, Guid slotId, CancellationToken ct)
        => Run(member => operations.DeleteSlotAsync(eventId, occurrenceId, slotId, member, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpPut("occurrences/{occurrenceId:guid}/roster/slots/{slotId:guid}/availability/me")]
    public Task<IActionResult> SetAvailability(Guid eventId, Guid occurrenceId, Guid slotId, SetEventAvailabilityRequest request, CancellationToken ct)
        => Run(member => operations.SetAvailabilityAsync(eventId, occurrenceId, slotId, member, request, ct), value => value.ETag);

    [HttpPost("occurrences/{occurrenceId:guid}/roster/slots/{slotId:guid}/assignments")]
    public Task<IActionResult> AssignRosterMember(Guid eventId, Guid occurrenceId, Guid slotId, AssignEventRosterMemberRequest request, CancellationToken ct)
        => Run(member => operations.AssignRosterMemberAsync(eventId, occurrenceId, slotId, member, request, Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpPost("occurrences/{occurrenceId:guid}/roster/assignments/{assignmentId:guid}/confirm")]
    public Task<IActionResult> ConfirmRosterAssignment(Guid eventId, Guid occurrenceId, Guid assignmentId, CancellationToken ct)
        => Run(member => operations.RespondToRosterAssignmentAsync(eventId, occurrenceId, assignmentId, member, true, ct), value => value.ETag);

    [HttpPost("occurrences/{occurrenceId:guid}/roster/assignments/{assignmentId:guid}/decline")]
    public Task<IActionResult> DeclineRosterAssignment(Guid eventId, Guid occurrenceId, Guid assignmentId, CancellationToken ct)
        => Run(member => operations.RespondToRosterAssignmentAsync(eventId, occurrenceId, assignmentId, member, false, ct), value => value.ETag);

    private async Task<IActionResult> Run<T>(Func<Guid, Task<Alife.Application.Common.Models.AppResult<T>>> action, Func<T, string>? eTag = null)
    {
        this.ApplyNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await action(memberId.Value);
        if (result.IsSuccess && eTag is not null) Response.Headers.ETag = eTag(result.Value!);
        return this.ToActionResult(result);
    }
}
