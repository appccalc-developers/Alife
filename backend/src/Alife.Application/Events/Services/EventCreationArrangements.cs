using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed record PreparedEventArrangements(IReadOnlyList<EventServiceSlot> Slots,
    IReadOnlyList<EventSession> Sessions, IReadOnlyList<EventVenue> NewVenues,
    IReadOnlyList<EventVenue> ReservedVenues, IReadOnlyList<EventVenueReservation> Bookings);

public static class EventCreationArrangements
{
    // Repeated arrangements are relative to each materialized occurrence, including DST changes.
    public static async Task<AppResult<PreparedEventArrangements>> PrepareAsync(IAlifeDbContext db,
        GroupEvent groupEvent, Guid actorId, EventPlanProposalDto plan,
        IReadOnlyList<EventOccurrence> occurrences, EventCreationArrangementsRequest request,
        DateTime now, CancellationToken ct, IReadOnlySet<Guid>? replacedReservationIds = null)
    {
        AppResult<PreparedEventArrangements> Invalid(string message) => AppResult<PreparedEventArrangements>.Validation(message);
        bool Enabled(string code) => plan.ModuleDecisions.Any(x => x.ModuleCode == code && x.Status != EventModuleDecisionStatus.Inactive);
        var slots = request.ServiceSlots ?? [];
        var sessions = request.Sessions ?? [];
        var bookings = request.VenueBookings ?? [];
        if (slots.Count > 50 || sessions.Count > 20 || bookings.Count > 20 || sessions.Any(x => x is null || x.Items is null || x.Items.Count > 50))
            return Invalid("Creation arrangements exceed the supported limits (50 slots, 20 sessions, 50 items per session, 20 bookings).");
        if (slots.Count > 0 && !Enabled("SERVICE.ROSTER") || sessions.Count > 0 && !Enabled("PROGRAM.PRODUCTION") || bookings.Count > 0 && !Enabled("PLACE.RESOURCE"))
            return Invalid("Arrangement details require their module to be enabled by the accepted plan.");
        foreach (var slot in slots)
        {
            if (slot is null || string.IsNullOrWhiteSpace(slot.RoleCode) || slot.RoleCode.Length > 100 ||
                slot.RequiredCount is < 1 or > 10000 || !ValidTime(slot.StartOffsetMinutes, slot.EndOffsetMinutes) ||
                string.IsNullOrWhiteSpace(slot.EligibilityCode) || slot.EligibilityCode.Length > 120 ||
                slot.EligibilityCode != "approvedGroupMember" && slot.EligibilityCode != "acceptedEventTeamMember" &&
                !(slot.EligibilityCode.StartsWith("acceptedRole:", StringComparison.Ordinal) && slot.EligibilityCode.Length > 13))
                return Invalid("Each service slot needs a role, valid eligibility, positive whole-number count and valid times.");
        }
        foreach (var session in sessions)
        {
            if (!ValidText(session.Title, 240) || !ValidTime(session.StartOffsetMinutes, session.EndOffsetMinutes))
                return Invalid("Each programme session needs bilingual titles and valid times.");
            if (session.Items.Any(item => item is null || !ValidText(item.Title, 240) ||
                item.Description is not null && !ValidText(item.Description, 2000, false) ||
                item.StartOffsetMinutes < 0 || item.DurationMinutes < 1 ||
                (long)item.StartOffsetMinutes + item.DurationMinutes > session.EndOffsetMinutes - session.StartOffsetMinutes))
                return Invalid("Programme items need bilingual titles and must fit inside their session.");
        }
        if (occurrences.Any(x => x.StartUtc < DateTime.UnixEpoch.AddDays(7) || x.StartUtc.Year > 9900))
            return Invalid("Event dates are outside the supported arrangement range.");

        var preparedSlots = occurrences.SelectMany(occurrence => slots.Select(slot => new EventServiceSlot
        {
            Id = Guid.NewGuid(), OccurrenceId = occurrence.Id, RoleCode = slot.RoleCode.Trim(),
            RequiredCount = slot.RequiredCount, EligibilityCode = slot.EligibilityCode.Trim(),
            StartUtc = occurrence.StartUtc.AddMinutes(slot.StartOffsetMinutes), EndUtc = occurrence.StartUtc.AddMinutes(slot.EndOffsetMinutes),
            CreatedUtc = now, UpdatedUtc = now
        })).ToArray();
        var preparedSessions = occurrences.SelectMany(occurrence => sessions.Select(session =>
        {
            var entity = new EventSession
            {
                Id = Guid.NewGuid(), OccurrenceId = occurrence.Id, TitleEn = session.Title.En.Trim(), TitleZh = session.Title.Zh.Trim(),
                StartUtc = occurrence.StartUtc.AddMinutes(session.StartOffsetMinutes), EndUtc = occurrence.StartUtc.AddMinutes(session.EndOffsetMinutes),
                Status = EventSessionStatus.Draft, CreatedUtc = now, UpdatedUtc = now
            };
            entity.ProgramItems = session.Items.Select((item, index) => new EventProgramItem
            {
                Id = Guid.NewGuid(), SessionId = entity.Id, TitleEn = item.Title.En.Trim(), TitleZh = item.Title.Zh.Trim(),
                DescriptionEn = item.Description?.En.Trim() ?? "", DescriptionZh = item.Description?.Zh.Trim() ?? "",
                StartOffsetMinutes = item.StartOffsetMinutes, DurationMinutes = item.DurationMinutes, SortOrder = (index + 1) * 10,
                CreatedUtc = now, UpdatedUtc = now
            }).ToArray();
            return entity;
        })).ToArray();
        var newVenues = new List<EventVenue>();
        var reservedVenues = new Dictionary<Guid, EventVenue>();
        var reservations = new List<EventVenueReservation>();
        foreach (var booking in bookings)
        {
            if (booking is null || !ValidTime(booking.StartOffsetMinutes, booking.EndOffsetMinutes) || booking.RequiredCapacity is < 1 or > 1000000 ||
                booking.VenueId.HasValue == (booking.NewVenue is not null))
                return Invalid("Each booking needs valid times, capacity and either an existing or new venue.");
            EventVenue venue;
            if (booking.VenueId.HasValue)
            {
                venue = await db.EventVenues.FirstOrDefaultAsync(x => x.Id == booking.VenueId && x.ManagingGroupId == groupEvent.GroupId, ct) ?? null!;
                if (venue is null || !venue.IsActive) return Invalid("The selected venue is unavailable in this group.");
                if (booking.VenueETag != $"\"venue-{venue.ConcurrencyToken:N}\"")
                    return AppResult<PreparedEventArrangements>.PreconditionFailed("The selected venue changed. Refresh venues in Arrangements and review again.");
            }
            else
            {
                var source = booking.NewVenue!;
                if (!ValidText(source.Name, 240) || source.Address is not null && !ValidText(source.Address, 1000, false) ||
                    source.Capacity is < 1 or > 1000000 || !source.IsActive)
                    return Invalid("New venues need bilingual names, a positive capacity and active status.");
                venue = new EventVenue { Id = Guid.NewGuid(), ManagingGroupId = groupEvent.GroupId,
                    NameEn = source.Name.En.Trim(), NameZh = source.Name.Zh.Trim(),
                    AddressEn = source.Address?.En.Trim() ?? "", AddressZh = source.Address?.Zh.Trim() ?? "",
                    Capacity = source.Capacity, IsActive = true, CreatedByMemberId = actorId, CreatedUtc = now, UpdatedUtc = now };
                newVenues.Add(venue);
            }
            if (booking.RequiredCapacity > venue.Capacity) return Invalid("The selected venue capacity is below the requested attendance.");
            reservedVenues[venue.Id] = venue;
            foreach (var occurrence in occurrences)
            {
                var start = occurrence.StartUtc.AddMinutes(booking.StartOffsetMinutes);
                var end = occurrence.StartUtc.AddMinutes(booking.EndOffsetMinutes);
                if (reservations.Any(x => x.VenueId == venue.Id && x.StartUtc < end && start < x.EndUtc) ||
                    await db.EventVenueReservations.AsNoTracking().AnyAsync(x => x.VenueId == venue.Id &&
                        x.Status == EventVenueReservationStatus.Confirmed && x.StartUtc < end && start < x.EndUtc &&
                        (replacedReservationIds == null || !replacedReservationIds.Contains(x.Id)), ct))
                    return AppResult<PreparedEventArrangements>.Conflict("A selected venue conflicts with another booking. Adjust the venue or time in Arrangements.");
                reservations.Add(new EventVenueReservation { Id = Guid.NewGuid(), VenueId = venue.Id,
                    EventId = groupEvent.Id, EventOccurrenceId = occurrence.Id, StartUtc = start, EndUtc = end,
                    RequiredCapacity = booking.RequiredCapacity, Status = EventVenueReservationStatus.Confirmed,
                    ReservedByMemberId = actorId, CreatedUtc = now, UpdatedUtc = now });
            }
        }
        return AppResult<PreparedEventArrangements>.Success(new(preparedSlots, preparedSessions, newVenues, reservedVenues.Values.ToArray(), reservations));
    }

    private static bool ValidTime(int start, int end) => start >= -10080 && end <= 44640 && end > start;
    private static bool ValidText(LocalizedTextDto? value, int limit, bool required = true) => value is not null &&
        value.En is not null && value.Zh is not null && value.En.Length <= limit && value.Zh.Length <= limit &&
        (!required || !string.IsNullOrWhiteSpace(value.En) && !string.IsNullOrWhiteSpace(value.Zh));
}
