using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Commands;

public sealed class SaveRosterShiftCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveRosterShiftCommand, AppResult<RosterShiftDto>>
{
    public async Task<AppResult<RosterShiftDto>> Handle(SaveRosterShiftCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await RosterPolicy.GetManagedEventAsync(db, authorization, request.EventId, request.CurrentMemberId, cancellationToken);
        if (groupEvent is null) return AppResult<RosterShiftDto>.Forbidden("Event not found or roster permission denied.");
        if (!RosterPolicy.IsEnabled(groupEvent))
            return AppResult<RosterShiftDto>.Conflict("Add roster preparation to this event before creating shifts.");
        var roleKey = RosterPolicy.NormalizeKey(request.RoleKey);
        if (roleKey.Length is < 1 or > 80) return AppResult<RosterShiftDto>.Validation("Role key is required and must be 80 characters or fewer.");
        if (string.IsNullOrWhiteSpace(request.NameEn) && string.IsNullOrWhiteSpace(request.NameZh))
            return AppResult<RosterShiftDto>.Validation("Add the shift name in at least one language.");
        if (request.EndUtc <= request.StartUtc || request.StartUtc < groupEvent.StartDate || request.EndUtc > groupEvent.EndDate)
            return AppResult<RosterShiftDto>.Validation("Shift times must be inside the event and end after they start.");
        if (request.RequiredPeople is < 1 or > 100) return AppResult<RosterShiftDto>.Validation("Required people must be between 1 and 100.");

        var shift = request.ShiftId.HasValue
            ? await db.EventRosterShifts.Include(x => x.Assignments).ThenInclude(x => x.Member)
                .FirstOrDefaultAsync(x => x.Id == request.ShiftId && x.EventId == groupEvent.Id, cancellationToken)
            : null;
        if (request.ShiftId.HasValue && shift is null) return AppResult<RosterShiftDto>.NotFound("Roster shift not found.");
        var before = shift is null ? null : new { shift.RoleKey, shift.NameEn, shift.NameZh, shift.StartUtc, shift.EndUtc, shift.RequiredPeople, shift.RequiredLabelsJson };
        var memberResponseAffected = shift is not null && (
            shift.RoleKey != roleKey || shift.NameEn != RosterPolicy.Truncate(request.NameEn, 200)
            || shift.NameZh != RosterPolicy.Truncate(request.NameZh, 200)
            || shift.StartUtc != request.StartUtc || shift.EndUtc != request.EndUtc);
        var now = DateTime.UtcNow;
        if (shift is null)
        {
            shift = new EventRosterShift { Id = Guid.NewGuid(), EventId = groupEvent.Id, CreatedUtc = now };
            db.EventRosterShifts.Add(shift);
        }
        shift.RoleKey = roleKey;
        shift.NameEn = RosterPolicy.Truncate(request.NameEn, 200);
        shift.NameZh = RosterPolicy.Truncate(request.NameZh, 200);
        shift.StartUtc = request.StartUtc;
        shift.EndUtc = request.EndUtc;
        shift.RequiredPeople = request.RequiredPeople;
        shift.RequiredLabelsJson = RosterPolicy.Write(RosterPolicy.NormalizeTags(request.RequiredLabels));
        shift.Notes = RosterPolicy.Truncate(request.Notes, 1000);
        shift.UpdatedUtc = now;
        if (memberResponseAffected)
        {
            foreach (var assignment in shift.Assignments.Where(x => x.Status is EventRosterAssignmentStatus.Accepted or EventRosterAssignmentStatus.ChangeRequested))
            {
                assignment.Status = EventRosterAssignmentStatus.Confirmed;
                assignment.MemberResponseNotes = string.Empty;
                assignment.RespondedUtc = null;
                assignment.UpdatedUtc = now;
                db.NotificationMessages.Add(new NotificationMessage
                {
                    Id = Guid.NewGuid(), RecipientMemberId = assignment.MemberId, CreatedByMemberId = request.CurrentMemberId,
                    GroupId = groupEvent.GroupId, EventId = groupEvent.Id, OccurredUtc = now,
                    ActionType = "event.roster.assignment.changed",
                    ActionDataJson = JsonSerializer.Serialize(new
                    {
                        title = new { en = "Your event assignment changed", zh = "活动排班已有调整" },
                        body = new { en = "Please review the updated role and time.", zh = "请重新确认调整后的岗位和时间。" },
                        actionUrl = $"/groups/{groupEvent.GroupId}/events/{groupEvent.Id}/my-roster"
                    }),
                    CreatedUtc = now, UpdatedUtc = now
                });
            }
        }
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, Action = before is null ? "roster.shift.created" : "roster.shift.updated",
            EntityType = "eventRosterShift", EntityId = shift.Id, BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new { shift.RoleKey, shift.StartUtc, shift.EndUtc, shift.RequiredPeople, shift.RequiredLabelsJson }), OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<RosterShiftDto>.Success(RosterPolicy.ToDto(shift));
    }
}
