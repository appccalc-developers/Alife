using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Transactions;

namespace Alife.Application.Rosters.Commands;

public sealed class ConfirmRosterAssignmentCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<ConfirmRosterAssignmentCommand, AppResult<RosterAssignmentDto>>
{
    public async Task<AppResult<RosterAssignmentDto>> Handle(ConfirmRosterAssignmentCommand request, CancellationToken cancellationToken)
    {
        using var transaction = new TransactionScope(
            TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.Serializable, Timeout = TimeSpan.FromSeconds(15) },
            TransactionScopeAsyncFlowOption.Enabled);
        var groupEvent = await RosterPolicy.GetManagedEventAsync(db, authorization, request.EventId, request.CurrentMemberId, cancellationToken);
        if (groupEvent is null) return AppResult<RosterAssignmentDto>.Forbidden("Event not found or roster permission denied.");
        if (!RosterPolicy.IsEnabled(groupEvent))
            return AppResult<RosterAssignmentDto>.Conflict("Roster preparation is not enabled for this event.");
        var shift = await db.EventRosterShifts.Include(x => x.Assignments).ThenInclude(x => x.Member)
            .FirstOrDefaultAsync(x => x.Id == request.ShiftId && x.EventId == groupEvent.Id, cancellationToken);
        if (shift is null) return AppResult<RosterAssignmentDto>.NotFound("Roster shift not found.");
        if (shift.Assignments.Count(x => x.Status is EventRosterAssignmentStatus.Confirmed or EventRosterAssignmentStatus.Accepted) >= shift.RequiredPeople)
            return AppResult<RosterAssignmentDto>.Conflict("This shift already has the required number of confirmed people.");
        var suggestion = (await RosterSuggestionEngine.SuggestAsync(db, groupEvent, shift, cancellationToken))
            .FirstOrDefault(x => x.MemberId == request.MemberId);
        if (suggestion is null) return AppResult<RosterAssignmentDto>.NotFound("Approved group member not found.");
        if (!suggestion.Eligible)
            return AppResult<RosterAssignmentDto>.Conflict("Resolve the member's scheduling conflicts before confirming this assignment.");

        var assignment = await db.EventRosterAssignments.Include(x => x.Member)
            .FirstOrDefaultAsync(x => x.ShiftId == shift.Id && x.MemberId == request.MemberId, cancellationToken);
        var now = DateTime.UtcNow;
        if (assignment is null)
        {
            assignment = new EventRosterAssignment { Id = Guid.NewGuid(), ShiftId = shift.Id, MemberId = request.MemberId };
            db.EventRosterAssignments.Add(assignment);
        }
        assignment.ConfirmedByMemberId = request.CurrentMemberId;
        assignment.Status = EventRosterAssignmentStatus.Confirmed;
        assignment.BasedOnSmartSuggestion = request.BasedOnSmartSuggestion;
        assignment.ConfirmationNotes = RosterPolicy.Truncate(request.ConfirmationNotes, 1000);
        assignment.MemberResponseNotes = string.Empty;
        assignment.ConfirmedUtc = now;
        assignment.RespondedUtc = null;
        assignment.UpdatedUtc = now;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, TargetMemberId = request.MemberId,
            Action = "roster.assignment.confirmed", EntityType = "eventRosterAssignment", EntityId = assignment.Id,
            AfterJson = JsonSerializer.Serialize(new { shift.Id, request.MemberId, request.BasedOnSmartSuggestion, reasons = suggestion.Reasons }), OccurredUtc = now
        });
        db.NotificationMessages.Add(new NotificationMessage
        {
            Id = Guid.NewGuid(), RecipientMemberId = request.MemberId, CreatedByMemberId = request.CurrentMemberId,
            GroupId = groupEvent.GroupId, EventId = groupEvent.Id, OccurredUtc = now,
            ActionType = "event.roster.assignment.proposed",
            ActionDataJson = JsonSerializer.Serialize(new
            {
                title = new { en = "Please review your event assignment", zh = "请确认活动排班" },
                body = new { en = $"{groupEvent.TitleEn}: {shift.NameEn}", zh = $"{groupEvent.TitleZh}：{shift.NameZh}" },
                actionUrl = $"/groups/{groupEvent.GroupId}/events/{groupEvent.Id}/my-roster"
            }),
            CreatedUtc = now, UpdatedUtc = now
        });
        assignment.Member ??= await db.Members.FindAsync([request.MemberId], cancellationToken) ?? new Member { Id = request.MemberId };
        await db.SaveChangesAsync(cancellationToken);
        transaction.Complete();
        return AppResult<RosterAssignmentDto>.Success(new RosterAssignmentDto(
            assignment.Id, assignment.MemberId, assignment.Member.DisplayName ?? "Member", assignment.Status,
            assignment.BasedOnSmartSuggestion, assignment.ConfirmationNotes, assignment.ConfirmedUtc,
            assignment.MemberResponseNotes, assignment.RespondedUtc));
    }
}
