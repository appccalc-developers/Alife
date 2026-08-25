using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Commands;

public sealed class RespondRosterAssignmentCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<RespondRosterAssignmentCommand, AppResult<MyRosterAssignmentDto>>
{
    public async Task<AppResult<MyRosterAssignmentDto>> Handle(RespondRosterAssignmentCommand request, CancellationToken cancellationToken)
    {
        var assignment = await db.EventRosterAssignments
            .Include(x => x.Shift).ThenInclude(x => x.Event)
            .FirstOrDefaultAsync(x => x.Id == request.AssignmentId && x.Shift.EventId == request.EventId, cancellationToken);
        if (assignment is null) return AppResult<MyRosterAssignmentDto>.NotFound("Roster assignment not found.");
        if (assignment.MemberId != request.CurrentMemberId
            || !await authorization.IsApprovedMemberAsync(assignment.Shift.Event.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<MyRosterAssignmentDto>.Forbidden("Only the assigned member can respond to this assignment.");
        if (assignment.Status != EventRosterAssignmentStatus.Confirmed)
            return AppResult<MyRosterAssignmentDto>.Conflict("This assignment is not awaiting a member response.");

        var notes = RosterPolicy.Truncate(request.Notes, 1000);
        if (request.Response == EventRosterMemberResponse.RequestChange && notes.Length == 0)
            return AppResult<MyRosterAssignmentDto>.Validation("Describe the change you need.");

        var now = DateTime.UtcNow;
        assignment.Status = request.Response switch
        {
            EventRosterMemberResponse.Accept => EventRosterAssignmentStatus.Accepted,
            EventRosterMemberResponse.Decline => EventRosterAssignmentStatus.Declined,
            EventRosterMemberResponse.RequestChange => EventRosterAssignmentStatus.ChangeRequested,
            _ => throw new ArgumentOutOfRangeException(nameof(request.Response))
        };
        assignment.MemberResponseNotes = notes;
        assignment.RespondedUtc = now;
        assignment.UpdatedUtc = now;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, TargetMemberId = request.CurrentMemberId,
            GroupId = assignment.Shift.Event.GroupId, EventId = assignment.Shift.EventId,
            Action = "roster.assignment.member-responded", EntityType = "eventRosterAssignment", EntityId = assignment.Id,
            AfterJson = JsonSerializer.Serialize(new { status = assignment.Status.ToString(), hasNotes = notes.Length > 0 }),
            OccurredUtc = now
        });
        if (assignment.ConfirmedByMemberId != request.CurrentMemberId)
        {
            db.NotificationMessages.Add(new NotificationMessage
            {
                Id = Guid.NewGuid(), RecipientMemberId = assignment.ConfirmedByMemberId, CreatedByMemberId = request.CurrentMemberId,
                GroupId = assignment.Shift.Event.GroupId, EventId = assignment.Shift.EventId, OccurredUtc = now,
                ActionType = "event.roster.assignment.responded",
                ActionDataJson = JsonSerializer.Serialize(new
                {
                    title = new { en = "A member responded to the roster", zh = "成员已回复活动排班" },
                    body = new { en = assignment.Status.ToString(), zh = assignment.Status switch
                    {
                        EventRosterAssignmentStatus.Accepted => "已接受",
                        EventRosterAssignmentStatus.Declined => "已拒绝",
                        _ => "请求调整"
                    } },
                    actionUrl = $"/groups/{assignment.Shift.Event.GroupId}/events/{assignment.Shift.EventId}/roster"
                }),
                CreatedUtc = now, UpdatedUtc = now
            });
        }
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<MyRosterAssignmentDto>.Success(new MyRosterAssignmentDto(
            assignment.Id, assignment.ShiftId, assignment.Shift.RoleKey,
            new WorkflowTextDto(assignment.Shift.NameEn, assignment.Shift.NameZh),
            assignment.Shift.StartUtc, assignment.Shift.EndUtc, assignment.Status, assignment.ConfirmedUtc,
            assignment.MemberResponseNotes, assignment.RespondedUtc));
    }
}
