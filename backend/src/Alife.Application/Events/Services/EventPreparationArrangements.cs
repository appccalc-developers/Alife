using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Composition;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

// The creation controls also edit persisted arrangements. Keep identity, assignments,
// metadata and occurrence scope while validating the same planning fields as creation.
public static class EventPreparationArrangements
{
    private static IQueryable<EventOccurrence> Query(IAlifeDbContext db, Guid eventId) => db.EventOccurrences
        .Where(x => x.EventId == eventId && x.Status != EventOccurrenceStatus.Cancelled)
        .Include(x => x.Sessions).ThenInclude(x => x.ProgramItems)
        .Include(x => x.ServiceSlots).ThenInclude(x => x.Assignments)
        .Include(x => x.ServiceSlots).ThenInclude(x => x.Availability)
        .Include(x => x.VenueReservations).ThenInclude(x => x.Venue);

    private static string ETag(EventOccurrence item) => $"\"arrangements-{EventCompositionEngine.Hash(new {
        item.Id, item.StartUtc, item.EndUtc, item.ProgrammeConcurrencyToken, item.RosterConcurrencyToken,
        bookings = item.VenueReservations.OrderBy(x => x.Id).Select(x => new { x.Id, x.ConcurrencyToken })
    })}\"";

    public static async Task<AppResult<PreparationArrangementsDto>> ReadAsync(IAlifeDbContext db, Guid eventId, Guid? occurrenceId, CancellationToken ct)
    {
        var item = await Query(db, eventId).AsNoTracking().Where(x => !occurrenceId.HasValue || x.Id == occurrenceId)
            .OrderBy(x => x.StartUtc).FirstOrDefaultAsync(ct);
        if (item is null) return AppResult<PreparationArrangementsDto>.NotFound("No matching event occurrence. / 没有可用的活动场次。");
        var series = await db.EventSeries.AsNoTracking().Include(x => x.Events)
            .FirstOrDefaultAsync(x => x.Events.Any(e => e.Id == eventId), ct);
        int Offset(DateTime date) => checked((int)(date - item.StartUtc).TotalMinutes);
        return AppResult<PreparationArrangementsDto>.Success(new(item.Id, item.StartUtc, item.EndUtc, ETag(item),
            item.ServiceSlots.OrderBy(x => x.StartUtc).ThenBy(x => x.Id).Select(x => new PreparationSlotRow(x.Id,
                new(x.RoleCode, x.RequiredCount, x.EligibilityCode, Offset(x.StartUtc), Offset(x.EndUtc)))).ToArray(),
            item.Sessions.Where(x => x.Status != EventSessionStatus.Cancelled).OrderBy(x => x.StartUtc).ThenBy(x => x.Id).Select(x => {
                var items = x.ProgramItems.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).ToArray();
                return new PreparationSessionRow(x.Id, new(new(x.TitleEn, x.TitleZh), Offset(x.StartUtc), Offset(x.EndUtc),
                    items.Select(i => new EventCreationProgramItemRequest(new(i.TitleEn, i.TitleZh), new(i.DescriptionEn, i.DescriptionZh),
                        i.StartOffsetMinutes, i.DurationMinutes)).ToArray()), items.Select(i => (Guid?)i.Id).ToArray());
            }).ToArray(),
            item.VenueReservations.Where(x => x.Status == EventVenueReservationStatus.Confirmed).OrderBy(x => x.StartUtc).ThenBy(x => x.Id)
                .Select(x => new PreparationVenueRow(x.Id, new(x.VenueId, $"\"venue-{x.Venue.ConcurrencyToken:N}\"", null,
                    x.RequiredCapacity, Offset(x.StartUtc), Offset(x.EndUtc)),
                    new(new(x.Venue.NameEn, x.Venue.NameZh), new(x.Venue.AddressEn, x.Venue.AddressZh), x.Venue.Capacity, x.Venue.IsActive))).ToArray(),
            series is null ? null : ListEventSeriesQueryHandler.ToDto(series)));
    }

    // Called by Plan acceptance inside its transaction; no separate persistence commit.
    public static async Task<AppResult<bool>> ApplyAsync(IAlifeDbContext db, GroupEvent groupEvent, Guid actor,
        EventPlanProposalDto plan, SavePreparationArrangementsRequest request, DateTime now, CancellationToken ct)
    {
        var item = await Query(db, groupEvent.Id).FirstOrDefaultAsync(x => x.Id == request.OccurrenceId, ct);
        if (item is null) return AppResult<bool>.Validation("The occurrence does not belong to this event. / 场次不属于此活动。");
        if (request.ETag != ETag(item)) return AppResult<bool>.PreconditionFailed("Arrangements changed. Reload and review. / 活动安排已更新，请重新读取并核对。");
        bool InvalidIds(IEnumerable<Guid?> ids, IEnumerable<Guid> existing) {
            var values = ids.Where(x => x.HasValue).Select(x => x!.Value).ToArray();
            return values.Distinct().Count() != values.Length || values.Except(existing).Any();
        }
        var slots = request.ServiceSlots; var sessions = request.Sessions; var bookings = request.VenueBookings;
        if (slots?.Any(x => x is null || x.Details is null) == true || sessions?.Any(x => x is null || x.Details?.Items is null || x.ItemIds is null || x.ItemIds.Count != x.Details.Items.Count) == true || bookings?.Any(x => x is null || x.Details is null) == true)
            return AppResult<bool>.Validation("Invalid arrangement rows. / 活动安排格式无效。");
        if (slots is not null && InvalidIds(slots.Select(x => x.Id), item.ServiceSlots.Select(x => x.Id)) ||
            sessions is not null && (InvalidIds(sessions.Select(x => x.Id), item.Sessions.Where(x => x.Status != EventSessionStatus.Cancelled).Select(x => x.Id)) ||
                sessions.Any(row => InvalidIds(row.ItemIds, item.Sessions.FirstOrDefault(x => x.Id == row.Id)?.ProgramItems.Select(x => x.Id) ?? []))) ||
            bookings is not null && InvalidIds(bookings.Select(x => x.Id), item.VenueReservations.Where(x => x.Status == EventVenueReservationStatus.Confirmed).Select(x => x.Id)))
            return AppResult<bool>.Validation("Arrangement IDs must be unique and belong to the selected occurrence. / 安排编号须唯一且属于所选场次。");
        var removedSlots = slots is null ? [] : item.ServiceSlots.Where(x => !slots.Any(row => row.Id == x.Id)).ToArray();
        if (removedSlots.Any(x => x.Assignments.Count > 0 || x.Availability.Count > 0))
            return AppResult<bool>.Conflict("A slot with member responses must be retained. / 已有成员安排或回应的岗位须保留。");
        var removedSessions = sessions is null ? [] : item.Sessions.Where(x => x.Status != EventSessionStatus.Cancelled && !sessions.Any(row => row.Id == x.Id)).ToArray();
        var removedItems = sessions is null ? [] : item.Sessions.SelectMany(x => x.ProgramItems)
            .Where(x => sessions.Any(row => row.Id == x.SessionId && !row.ItemIds.Contains(x.Id))).ToArray();
        var removedSlotIds = removedSlots.Select(x => x.Id).ToArray();
        var removedSessionIds = removedSessions.Select(x => x.Id).ToArray();
        var removedItemIds = removedItems.Select(x => x.Id).ToArray();
        if (await db.EventServiceSlots.AnyAsync(x => !removedSlotIds.Contains(x.Id) &&
            (x.SessionId.HasValue && removedSessionIds.Contains(x.SessionId.Value) ||
             x.ProgramItemId.HasValue && removedItemIds.Contains(x.ProgramItemId.Value)), ct))
            return AppResult<bool>.Conflict("Keep sessions and items linked to service slots. / 请保留岗位关联的环节和节目。");
        var replaceIds = bookings is null ? new HashSet<Guid>() : item.VenueReservations.Where(x => x.Status == EventVenueReservationStatus.Confirmed).Select(x => x.Id).ToHashSet();
        var prepared = await EventCreationArrangements.PrepareAsync(db, groupEvent, actor, plan, [item],
            new(slots?.Select(x => x.Details).ToArray(), sessions?.Select(x => x.Details).ToArray(), bookings?.Select(x => x.Details).ToArray()), now, ct, replaceIds);
        if (!prepared.IsSuccess) return prepared.Status == AppResultStatus.PreconditionFailed ? AppResult<bool>.PreconditionFailed(prepared.Message!) :
            prepared.Status == AppResultStatus.Conflict ? AppResult<bool>.Conflict(prepared.Message!) : AppResult<bool>.Validation(prepared.Message!);
        var data = prepared.Value!;
        foreach (var old in removedSlots) db.EventServiceSlots.Remove(old);
        for (var i = 0; i < (slots?.Count ?? 0); i++) {
            var source = data.Slots[i]; var target = item.ServiceSlots.FirstOrDefault(x => x.Id == slots![i].Id);
            if (target is null) db.EventServiceSlots.Add(source);
            else { target.RoleCode = source.RoleCode; target.RequiredCount = source.RequiredCount; target.EligibilityCode = source.EligibilityCode;
                target.StartUtc = source.StartUtc; target.EndUtc = source.EndUtc; target.UpdatedUtc = now; }
        }
        foreach (var old in removedSessions) { old.Status = EventSessionStatus.Cancelled; old.UpdatedUtc = now; }
        foreach (var old in removedItems) db.EventProgramItems.Remove(old);
        for (var i = 0; i < (sessions?.Count ?? 0); i++) {
            var row = sessions![i]; var source = data.Sessions[i]; var target = item.Sessions.FirstOrDefault(x => x.Id == row.Id);
            if (target is null) { db.EventSessions.Add(source); continue; }
            target.TitleEn = source.TitleEn; target.TitleZh = source.TitleZh; target.StartUtc = source.StartUtc; target.EndUtc = source.EndUtc; target.UpdatedUtc = now;
            var proposedItems = source.ProgramItems.ToArray();
            for (var j = 0; j < proposedItems.Length; j++) {
                var next = proposedItems[j]; var old = target.ProgramItems.FirstOrDefault(x => x.Id == row.ItemIds[j]);
                if (old is null) { next.SessionId = target.Id; target.ProgramItems.Add(next); }
                else { old.TitleEn = next.TitleEn; old.TitleZh = next.TitleZh; old.DescriptionEn = next.DescriptionEn; old.DescriptionZh = next.DescriptionZh;
                    old.StartOffsetMinutes = next.StartOffsetMinutes; old.DurationMinutes = next.DurationMinutes; old.SortOrder = next.SortOrder; old.UpdatedUtc = now; }
            }
        }
        if (bookings is not null) foreach (var old in item.VenueReservations.Where(x => x.Status == EventVenueReservationStatus.Confirmed && !bookings.Any(row => row.Id == x.Id))) {
            old.Status = EventVenueReservationStatus.Released; old.ReleasedByMemberId = actor; old.ReleasedUtc = now; old.UpdatedUtc = now; old.ConcurrencyToken = Guid.NewGuid();
            old.Venue.ConcurrencyToken = Guid.NewGuid(); old.Venue.UpdatedUtc = now;
        }
        db.EventVenues.AddRange(data.NewVenues);
        for (var i = 0; i < (bookings?.Count ?? 0); i++) {
            var source = data.Bookings[i]; var target = item.VenueReservations.FirstOrDefault(x => x.Id == bookings![i].Id);
            if (target is null) db.EventVenueReservations.Add(source);
            else { target.Venue.ConcurrencyToken = Guid.NewGuid(); target.Venue.UpdatedUtc = now;
                target.VenueId = source.VenueId; target.StartUtc = source.StartUtc; target.EndUtc = source.EndUtc;
                target.RequiredCapacity = source.RequiredCapacity; target.ConcurrencyToken = Guid.NewGuid(); target.UpdatedUtc = now; }
        }
        foreach (var venue in data.ReservedVenues) { venue.ConcurrencyToken = Guid.NewGuid(); venue.UpdatedUtc = now; }
        if (slots is not null) item.RosterConcurrencyToken = Guid.NewGuid();
        if (sessions is not null) item.ProgrammeConcurrencyToken = Guid.NewGuid();
        item.UpdatedUtc = now;
        return AppResult<bool>.Success(true);
    }
}
