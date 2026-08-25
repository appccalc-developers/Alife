using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Queries;

public sealed class GetEventRosterPlanOptionsQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventRosterPlanOptionsQuery, AppResult<EventRosterPlanOptionsDto>>
{
    public async Task<AppResult<EventRosterPlanOptionsDto>> Handle(
        GetEventRosterPlanOptionsQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await RosterPolicy.GetManagedEventAsync(
            db, authorization, request.EventId, request.CurrentMemberId, cancellationToken);
        if (groupEvent is null)
            return AppResult<EventRosterPlanOptionsDto>.Forbidden("Event not found or roster permission denied.");
        if (!RosterPolicy.IsEnabled(groupEvent))
            return AppResult<EventRosterPlanOptionsDto>.Conflict("Roster preparation is not enabled for this event.");

        var shifts = await db.EventRosterShifts.AsNoTracking()
            .Include(x => x.Assignments)
            .Where(x => x.EventId == groupEvent.Id)
            .OrderBy(x => x.StartUtc)
            .ThenBy(x => x.RoleKey)
            .ToListAsync(cancellationToken);
        if (shifts.Count == 0)
            return AppResult<EventRosterPlanOptionsDto>.Success(
                new EventRosterPlanOptionsDto(groupEvent.Id, DateTime.UtcNow, []));

        var candidatesByShift = await RosterSuggestionEngine.SuggestManyAsync(db, groupEvent, shifts, cancellationToken);

        var profiles = await db.GroupMemberSchedulingProfiles.AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId)
            .ToDictionaryAsync(x => x.MemberId, x => x.MaxAssignmentsPerDay, cancellationToken);
        var timeZoneId = await db.EventPlans.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id)
            .SelectMany(x => x.Occurrences.OrderBy(o => o.SortOrder).Take(1).Select(o => o.TimeZoneId))
            .FirstOrDefaultAsync(cancellationToken) ?? "UTC";
        TimeZoneInfo timeZone;
        try { timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); }
        catch (TimeZoneNotFoundException) { timeZone = TimeZoneInfo.Utc; }
        catch (InvalidTimeZoneException) { timeZone = TimeZoneInfo.Utc; }

        var schemes = new[]
        {
            BuildScheme("balanced", new("Balanced rotation", "公平轮换"),
                new("Shares service across available people and reduces consecutive-week load where possible.", "在符合岗位和时间要求的前提下，优先分散服事负担并减少连续周安排。"),
                shifts, candidatesByShift, profiles, timeZone, preferExperience: false),
            BuildScheme("experienced", new("Experience first", "经验优先"),
                new("Prioritises recent same-role experience while still enforcing every hard constraint.", "优先采用近期有同岗位经验的成员，同时继续执行所有时间、资格和人数限制。"),
                shifts, candidatesByShift, profiles, timeZone, preferExperience: true)
        };
        return AppResult<EventRosterPlanOptionsDto>.Success(
            new EventRosterPlanOptionsDto(groupEvent.Id, DateTime.UtcNow, schemes));
    }

    private static RosterPlanSchemeDto BuildScheme(
        string key,
        Events.Dtos.WorkflowTextDto name,
        Events.Dtos.WorkflowTextDto description,
        IReadOnlyList<Domain.Entities.EventRosterShift> shifts,
        IReadOnlyDictionary<Guid, IReadOnlyList<RosterCandidateSuggestionDto>> candidatesByShift,
        IReadOnlyDictionary<Guid, int> dailyLimits,
        TimeZoneInfo timeZone,
        bool preferExperience)
    {
        var proposed = new List<(Guid MemberId, DateTime StartUtc, DateTime EndUtc)>();
        var proposedPerDay = new Dictionary<(Guid MemberId, DateTime LocalDate), int>();
        var existingPerDay = shifts
            .SelectMany(shift => shift.Assignments
                .Where(x => x.Status is Domain.Enums.EventRosterAssignmentStatus.Confirmed or Domain.Enums.EventRosterAssignmentStatus.Accepted)
                .Select(x => new
                {
                    x.MemberId,
                    LocalDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(shift.StartUtc, DateTimeKind.Utc), timeZone).Date
                }))
            .GroupBy(x => (x.MemberId, x.LocalDate))
            .ToDictionary(x => x.Key, x => x.Count());
        var proposedCounts = new Dictionary<Guid, int>();
        var resultByShift = new Dictionary<Guid, RosterPlanShiftSuggestionDto>();

        var orderedShifts = shifts.OrderBy(shift =>
        {
            var committed = shift.Assignments.Count(x => x.Status is Domain.Enums.EventRosterAssignmentStatus.Confirmed or Domain.Enums.EventRosterAssignmentStatus.Accepted);
            var need = Math.Max(0, shift.RequiredPeople - committed);
            var eligible = candidatesByShift[shift.Id].Count(x => x.Eligible);
            return eligible - need;
        }).ThenBy(x => x.StartUtc).ToArray();

        foreach (var shift in orderedShifts)
        {
            var committedMemberIds = shift.Assignments
                .Where(x => x.Status is Domain.Enums.EventRosterAssignmentStatus.Confirmed or Domain.Enums.EventRosterAssignmentStatus.Accepted)
                .Select(x => x.MemberId).ToHashSet();
            var alreadyCommitted = committedMemberIds.Count;
            var needed = Math.Max(0, shift.RequiredPeople - alreadyCommitted);
            var selected = new List<RosterPlanAssignmentSuggestionDto>();
            var localDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(shift.StartUtc, DateTimeKind.Utc), timeZone).Date;

            for (var slot = 0; slot < needed; slot++)
            {
                var next = candidatesByShift[shift.Id]
                    .Where(candidate => candidate.Eligible && !committedMemberIds.Contains(candidate.MemberId)
                        && selected.All(x => x.MemberId != candidate.MemberId)
                        && proposed.All(x => x.MemberId != candidate.MemberId || x.StartUtc >= shift.EndUtc || x.EndUtc <= shift.StartUtc)
                        && existingPerDay.GetValueOrDefault((candidate.MemberId, localDate))
                            + proposedPerDay.GetValueOrDefault((candidate.MemberId, localDate))
                            < dailyLimits.GetValueOrDefault(candidate.MemberId, 1))
                    .OrderByDescending(candidate => AdjustedScore(candidate, proposedCounts.GetValueOrDefault(candidate.MemberId), preferExperience))
                    .ThenBy(candidate => candidate.DisplayName)
                    .FirstOrDefault();
                if (next is null) break;

                selected.Add(new RosterPlanAssignmentSuggestionDto(
                    shift.Id, next.MemberId, next.DisplayName,
                    AdjustedScore(next, proposedCounts.GetValueOrDefault(next.MemberId), preferExperience),
                    next.RecentAssignmentCount, next.PastSameRoleCount, next.ConsecutiveServiceWeeks, next.Reasons));
                proposed.Add((next.MemberId, shift.StartUtc, shift.EndUtc));
                proposedPerDay[(next.MemberId, localDate)] = proposedPerDay.GetValueOrDefault((next.MemberId, localDate)) + 1;
                proposedCounts[next.MemberId] = proposedCounts.GetValueOrDefault(next.MemberId) + 1;
            }

            var unfilled = needed - selected.Count;
            Events.Dtos.WorkflowTextDto? gap = null;
            if (unfilled > 0)
            {
                var eligibleCount = candidatesByShift[shift.Id].Count(x => x.Eligible && !committedMemberIds.Contains(x.MemberId));
                gap = eligibleCount == 0
                    ? new("No eligible member currently satisfies this shift's time and required-label constraints.", "目前没有成员同时满足这个班次的时间与必要标签要求。")
                    : new("Eligible people are already used by overlapping shifts or have reached their daily limit in this draft.", "符合条件的成员已被安排到重叠班次，或在本草案中达到每日上限。");
            }
            resultByShift[shift.Id] = new RosterPlanShiftSuggestionDto(
                shift.Id, shift.RoleKey, new(shift.NameEn, shift.NameZh), shift.StartUtc, shift.EndUtc,
                shift.RequiredPeople, alreadyCommitted, selected, unfilled, gap);
        }

        var resultShifts = shifts.Select(x => resultByShift[x.Id]).ToArray();
        return new RosterPlanSchemeDto(key, name, description,
            resultShifts.Sum(x => x.SuggestedAssignments.Count), resultShifts.Sum(x => x.UnfilledCount), resultShifts);
    }

    private static int AdjustedScore(RosterCandidateSuggestionDto candidate, int alreadySelected, bool preferExperience) =>
        preferExperience
            ? candidate.Score + Math.Min(120, candidate.PastSameRoleCount * 30) - alreadySelected * 10
            : candidate.Score - candidate.ConsecutiveServiceWeeks * 20 - alreadySelected * 30;
}
