using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.SaveEventProgrammeItem;

public sealed class SaveEventProgrammeItemCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveEventProgrammeItemCommand, AppResult<EventProgrammeItemDto>>
{
    public async Task<AppResult<EventProgrammeItemDto>> Handle(
        SaveEventProgrammeItemCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await EventProgrammePolicy.GetManagedEventAsync(
            db, authorization, request.EventId, request.CurrentMemberId, cancellationToken);
        if (groupEvent is null) return AppResult<EventProgrammeItemDto>.Forbidden("Event not found or programme permission denied.");
        if (!EventProgrammePolicy.IsEnabled(groupEvent))
            return AppResult<EventProgrammeItemDto>.Conflict("Add programme preparation to this event before building a run sheet.");
        if (request.EndUtc <= request.StartUtc || request.StartUtc < groupEvent.StartDate || request.EndUtc > groupEvent.EndDate)
            return AppResult<EventProgrammeItemDto>.Validation("Programme times must stay inside the event and end after they start.");
        if (string.IsNullOrWhiteSpace(request.TitleEn) && string.IsNullOrWhiteSpace(request.TitleZh))
            return AppResult<EventProgrammeItemDto>.Validation("Add a programme item title in at least one language.");
        if (request.SortOrder is < 0 or > 10000)
            return AppResult<EventProgrammeItemDto>.Validation("Sort order must be between 0 and 10,000.");

        var occurrenceId = request.EventOccurrenceId;
        if (!occurrenceId.HasValue && groupEvent.Plan?.Occurrences.Count == 1)
            occurrenceId = groupEvent.Plan.Occurrences.Single().Id;
        var occurrence = occurrenceId.HasValue
            ? groupEvent.Plan?.Occurrences.FirstOrDefault(x => x.Id == occurrenceId.Value)
            : null;
        if (occurrenceId.HasValue && occurrence is null)
            return AppResult<EventProgrammeItemDto>.Validation("The selected session does not belong to this event.");
        if (occurrence is not null && (request.StartUtc < occurrence.StartUtc || request.EndUtc > occurrence.EndUtc))
            return AppResult<EventProgrammeItemDto>.Validation("Programme times must stay inside the selected session.");

        EventRosterShift? rosterShift = null;
        if (request.RosterShiftId.HasValue)
        {
            rosterShift = await db.EventRosterShifts.Include(x => x.Assignments).ThenInclude(x => x.Member)
                .FirstOrDefaultAsync(x => x.Id == request.RosterShiftId.Value && x.EventId == groupEvent.Id, cancellationToken);
            if (rosterShift is null)
                return AppResult<EventProgrammeItemDto>.Validation("The selected roster shift does not belong to this event.");
        }
        if (request.OwnerMemberId.HasValue && !await db.GroupMemberships.AsNoTracking().AnyAsync(
                x => x.GroupId == groupEvent.GroupId && x.MemberId == request.OwnerMemberId.Value && x.Status == MembershipStatus.Approved,
                cancellationToken))
            return AppResult<EventProgrammeItemDto>.Validation("The programme owner must be an approved group member.");

        var item = request.ItemId.HasValue
            ? await db.EventProgrammeItems.Include(x => x.OwnerMember)
                .Include(x => x.RosterShift).ThenInclude(x => x!.Assignments).ThenInclude(x => x.Member)
                .FirstOrDefaultAsync(x => x.Id == request.ItemId.Value && x.EventId == groupEvent.Id, cancellationToken)
            : null;
        if (request.ItemId.HasValue && item is null)
            return AppResult<EventProgrammeItemDto>.NotFound("Programme item not found.");
        var created = item is null;
        var before = item is null ? null : new
        {
            item.StartUtc, item.EndUtc, item.TitleEn, item.TitleZh, item.OwnerMemberId,
            item.RosterShiftId, item.RequiresHandover, item.Status
        };
        var now = DateTime.UtcNow;
        item ??= new EventProgrammeItem { Id = Guid.NewGuid(), EventId = groupEvent.Id, CreatedUtc = now };
        if (created) db.EventProgrammeItems.Add(item);
        item.EventOccurrenceId = occurrenceId;
        item.RosterShiftId = rosterShift?.Id;
        item.RosterShift = rosterShift;
        item.OwnerMemberId = request.OwnerMemberId;
        item.SortOrder = request.SortOrder;
        item.StartUtc = request.StartUtc;
        item.EndUtc = request.EndUtc;
        item.TitleEn = EventProgrammePolicy.Text(request.TitleEn, 300);
        item.TitleZh = EventProgrammePolicy.Text(request.TitleZh, 300);
        item.InstructionsEn = EventProgrammePolicy.Text(request.InstructionsEn, 2000);
        item.InstructionsZh = EventProgrammePolicy.Text(request.InstructionsZh, 2000);
        item.RequiresHandover = request.RequiresHandover;
        item.HandoverEn = EventProgrammePolicy.Text(request.HandoverEn, 2000);
        item.HandoverZh = EventProgrammePolicy.Text(request.HandoverZh, 2000);
        item.Status = request.Status;
        item.UpdatedByMemberId = request.CurrentMemberId;
        item.UpdatedUtc = now;
        if (item.Status == EventProgrammeItemStatus.Ready && !EventProgrammePolicy.CanBeReady(item))
            return AppResult<EventProgrammeItemDto>.Validation("A ready programme item needs an owner or accepted roster assignee and any required handover notes.");
        if (item.Status == EventProgrammeItemStatus.Completed && now < item.StartUtc)
            return AppResult<EventProgrammeItemDto>.Validation("A programme item cannot be completed before it starts.");

        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            Action = created ? "event.programme.item.created" : "event.programme.item.updated",
            EntityType = nameof(EventProgrammeItem), EntityId = item.Id, BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new
            {
                item.EventOccurrenceId, item.RosterShiftId, item.OwnerMemberId, item.StartUtc, item.EndUtc,
                item.RequiresHandover, item.Status
            }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);

        item.OwnerMember = item.OwnerMemberId.HasValue
            ? await db.Members.AsNoTracking().FirstOrDefaultAsync(x => x.Id == item.OwnerMemberId.Value, cancellationToken)
            : null;
        return AppResult<EventProgrammeItemDto>.Success(EventProgrammePolicy.ToDto(item));
    }
}
