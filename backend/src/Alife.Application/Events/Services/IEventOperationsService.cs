using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

public interface IEventOperationsService
{
    Task<AppResult<IReadOnlyList<EventOccurrenceDto>>> ListOccurrencesAsync(Guid eventId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventTeamWorkspaceDto>> GetTeamAsync(Guid eventId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventTeamMemberDto>> InviteTeamMemberAsync(Guid eventId, Guid memberId, InviteEventTeamMemberRequest request, CancellationToken ct);
    Task<AppResult<EventTeamMemberDto>> RespondToTeamInviteAsync(Guid eventId, Guid teamMemberId, Guid memberId, bool accept, CancellationToken ct);
    Task<AppResult<EventTeamMemberDto>> EndTeamMemberAsync(Guid eventId, Guid teamMemberId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventTaskDto>> CreateTaskAsync(Guid eventId, Guid memberId, CreateEventTaskRequest request, CancellationToken ct);
    Task<AppResult<EventTaskDto>> UpdateTaskAsync(Guid eventId, Guid taskId, Guid memberId, UpdateEventTaskRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventTaskDto>> CancelTaskAsync(Guid eventId, Guid taskId, Guid memberId, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventTaskDto>> AddTaskDependencyAsync(Guid eventId, Guid taskId, Guid memberId, AddEventTaskDependencyRequest request, CancellationToken ct);
    Task<AppResult<EventTaskDto>> RemoveTaskDependencyAsync(Guid eventId, Guid taskId, Guid dependencyId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventTaskDto>> AddTaskBlockerAsync(Guid eventId, Guid taskId, Guid memberId, AddEventTaskBlockerRequest request, CancellationToken ct);
    Task<AppResult<EventTaskDto>> ResolveTaskBlockerAsync(Guid eventId, Guid taskId, Guid blockerId, Guid memberId, ResolveEventTaskBlockerRequest request, CancellationToken ct);
    Task<AppResult<EventProgrammeDto>> GetProgrammeAsync(Guid eventId, Guid occurrenceId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventProgrammeDto>> CreateSessionAsync(Guid eventId, Guid occurrenceId, Guid memberId, SaveEventSessionRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventProgrammeDto>> UpdateSessionAsync(Guid eventId, Guid occurrenceId, Guid sessionId, Guid memberId, SaveEventSessionRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventProgrammeDto>> DeleteSessionAsync(Guid eventId, Guid occurrenceId, Guid sessionId, Guid memberId, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventProgrammeDto>> CreateProgramItemAsync(Guid eventId, Guid occurrenceId, Guid sessionId, Guid memberId, SaveEventProgramItemRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventProgrammeDto>> UpdateProgramItemAsync(Guid eventId, Guid occurrenceId, Guid itemId, Guid memberId, SaveEventProgramItemRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventProgrammeDto>> DeleteProgramItemAsync(Guid eventId, Guid occurrenceId, Guid itemId, Guid memberId, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventProgrammeDto>> ReorderProgramItemsAsync(Guid eventId, Guid occurrenceId, Guid sessionId, Guid memberId, ReorderEventProgramItemsRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventRosterDto>> GetRosterAsync(Guid eventId, Guid occurrenceId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventRosterDto>> CreateSlotAsync(Guid eventId, Guid occurrenceId, Guid memberId, SaveEventServiceSlotRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventRosterDto>> UpdateSlotAsync(Guid eventId, Guid occurrenceId, Guid slotId, Guid memberId, SaveEventServiceSlotRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventRosterDto>> DeleteSlotAsync(Guid eventId, Guid occurrenceId, Guid slotId, Guid memberId, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventRosterDto>> SetAvailabilityAsync(Guid eventId, Guid occurrenceId, Guid slotId, Guid memberId, SetEventAvailabilityRequest request, CancellationToken ct);
    Task<AppResult<EventRosterDto>> AssignRosterMemberAsync(Guid eventId, Guid occurrenceId, Guid slotId, Guid memberId, AssignEventRosterMemberRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventRosterDto>> RespondToRosterAssignmentAsync(Guid eventId, Guid occurrenceId, Guid assignmentId, Guid memberId, bool confirm, CancellationToken ct);
}
