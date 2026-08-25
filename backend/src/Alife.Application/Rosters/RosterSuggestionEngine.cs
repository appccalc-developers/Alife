using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters;

internal static class RosterSuggestionEngine
{
    public static async Task<IReadOnlyList<RosterCandidateSuggestionDto>> SuggestAsync(
        IAlifeDbContext db, GroupEvent groupEvent, EventRosterShift shift, CancellationToken cancellationToken)
    {
        var results = await SuggestManyAsync(db, groupEvent, [shift], cancellationToken);
        return results[shift.Id];
    }

    public static async Task<IReadOnlyDictionary<Guid, IReadOnlyList<RosterCandidateSuggestionDto>>> SuggestManyAsync(
        IAlifeDbContext db, GroupEvent groupEvent, IReadOnlyList<EventRosterShift> shifts, CancellationToken cancellationToken)
    {
        if (shifts.Count == 0)
            return new Dictionary<Guid, IReadOnlyList<RosterCandidateSuggestionDto>>();

        var members = await db.GroupMemberships.AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId && x.Status == MembershipStatus.Approved)
            .Select(x => new CandidateMember(x.MemberId, x.Member.DisplayName ?? "Member"))
            .ToListAsync(cancellationToken);
        var profiles = await db.GroupMemberSchedulingProfiles.AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId)
            .ToDictionaryAsync(x => x.MemberId, cancellationToken);
        var capabilityCatalog = await db.GroupRosterCapabilities.AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId)
            .ToDictionaryAsync(x => x.Key, cancellationToken);
        var currentAssignments = await db.EventRosterAssignments.AsNoTracking()
            .Where(x => x.Shift.EventId == groupEvent.Id)
            .Select(x => new CurrentAssignment(x.ShiftId, x.MemberId, x.Status, x.Shift.StartUtc, x.Shift.EndUtc))
            .ToListAsync(cancellationToken);
        var earliestHistoryUtc = shifts.Min(x => x.StartUtc).AddDays(-180);
        var latestShiftUtc = shifts.Max(x => x.StartUtc);
        var history = await db.EventRosterAssignments.AsNoTracking()
            .Where(x => x.Shift.Event.GroupId == groupEvent.GroupId
                && x.Shift.EndUtc < latestShiftUtc
                && x.Shift.EndUtc >= earliestHistoryUtc
                && (x.Status == EventRosterAssignmentStatus.Confirmed || x.Status == EventRosterAssignmentStatus.Accepted))
            .Select(x => new HistoryAssignment(x.MemberId, x.Shift.RoleKey, x.Shift.EndUtc))
            .ToListAsync(cancellationToken);
        var timeZoneId = await db.EventPlans.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .SelectMany(x => x.Occurrences.OrderBy(o => o.SortOrder).Take(1).Select(o => o.TimeZoneId))
            .FirstOrDefaultAsync(cancellationToken) ?? "UTC";
        TimeZoneInfo timeZone;
        try { timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); }
        catch (TimeZoneNotFoundException) { timeZone = TimeZoneInfo.Utc; }
        catch (InvalidTimeZoneException) { timeZone = TimeZoneInfo.Utc; }

        var nowUtc = DateTime.UtcNow;
        return shifts.ToDictionary(
            shift => shift.Id,
            shift => (IReadOnlyList<RosterCandidateSuggestionDto>)BuildSuggestions(
                members, profiles, capabilityCatalog, currentAssignments, history, shift, timeZone, nowUtc));
    }

    private static RosterCandidateSuggestionDto[] BuildSuggestions(
        IReadOnlyList<CandidateMember> members,
        IReadOnlyDictionary<Guid, GroupMemberSchedulingProfile> profiles,
        IReadOnlyDictionary<string, GroupRosterCapability> capabilityCatalog,
        IReadOnlyList<CurrentAssignment> currentAssignments,
        IReadOnlyList<HistoryAssignment> allHistory,
        EventRosterShift shift,
        TimeZoneInfo timeZone,
        DateTime nowUtc)
    {
        var existing = currentAssignments.Where(x =>
            x.Status is EventRosterAssignmentStatus.Confirmed or EventRosterAssignmentStatus.Accepted).ToArray();
        var currentResponses = currentAssignments.Where(x => x.ShiftId == shift.Id)
            .GroupBy(x => x.MemberId).ToDictionary(x => x.Key, x => x.Last().Status);
        var historyStartUtc = shift.StartUtc.AddDays(-180);
        var history = allHistory.Where(x => x.EndUtc < shift.StartUtc && x.EndUtc >= historyStartUtc).ToArray();
        var requiredLabels = RosterPolicy.Read<string>(shift.RequiredLabelsJson).ToHashSet(StringComparer.Ordinal);
        var localStart = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(shift.StartUtc, DateTimeKind.Utc), timeZone);
        var localEnd = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(shift.EndUtc, DateTimeKind.Utc), timeZone);

        return members.Select(member =>
        {
            profiles.TryGetValue(member.MemberId, out var profile);
            var managerProfile = RosterPolicy.ReadManagerProfile(profile?.ManagerLabelsJson, profile?.ManagerUpdatedUtc);
            var managerProfileUsable = RosterPolicy.IsManagerProfileUsable(managerProfile, nowUtc);
            var qualifications = managerProfile.Qualifications.ToDictionary(x => x.Key, StringComparer.Ordinal);
            var labels = (managerProfileUsable ? managerProfile.Labels : [])
                .Where(key => !capabilityCatalog.TryGetValue(key, out var capability)
                    || capability.IsActive && !capability.RequiresExpiry)
                .Concat(managerProfileUsable
                    ? managerProfile.Qualifications.Where(x =>
                            capabilityCatalog.TryGetValue(x.Key, out var capability)
                            && capability.IsActive
                            && (!capability.RequiresExpiry || x.ValidUntilUtc > nowUtc))
                        .Select(x => x.Key)
                    : [])
                .ToHashSet(StringComparer.Ordinal);
            var preferredRoles = RosterPolicy.Read<string>(profile?.PreferredRoleKeysJson).ToHashSet(StringComparer.Ordinal);
            var selfWindows = RosterPolicy.ReadWindowsForRoster(profile?.UnavailableWindowsJson);
            var managerWindows = managerProfileUsable ? managerProfile.UnavailableWindows : [];
            var reasons = new List<RosterSuggestionReasonDto>();
            var eligible = true;
            var score = 100;

            if (currentResponses.TryGetValue(member.MemberId, out var currentStatus)
                && currentStatus is EventRosterAssignmentStatus.Declined or EventRosterAssignmentStatus.ChangeRequested)
            {
                eligible = false;
                score -= 100;
                reasons.Add(currentStatus == EventRosterAssignmentStatus.Declined
                    ? Reason("member-declined", "The member declined this assignment.", "成员已拒绝这项安排。", "conflict")
                    : Reason("change-requested", "The member requested a change to this assignment.", "成员已请求调整这项安排。", "conflict"));
            }
            if (!managerProfileUsable && managerProfile.ConfirmationStatus is "pending" or "confirmed")
                reasons.Add(Reason("manager-profile-review-required",
                    "Manager-assisted information is pending confirmation or review and was not used.",
                    "管理者代录资料尚待确认或复核，本次建议未采用这些资料。", "info"));

            var expiredQualifications = requiredLabels.Where(label =>
                capabilityCatalog.TryGetValue(label, out var capability)
                && capability.IsActive && capability.RequiresExpiry
                && qualifications.TryGetValue(label, out var qualification)
                && (!qualification.ValidUntilUtc.HasValue || qualification.ValidUntilUtc.Value <= nowUtc)).ToArray();
            if (expiredQualifications.Length > 0)
            {
                eligible = false; score -= 100;
                reasons.Add(Reason("required-qualification-expired",
                    $"Required qualification expired: {string.Join(", ", expiredQualifications)}",
                    $"岗位所需资格已经过期：{string.Join("、", expiredQualifications)}", "conflict"));
            }
            var missingLabels = requiredLabels.Where(label => !labels.Contains(label) && !expiredQualifications.Contains(label)).ToArray();
            if (missingLabels.Length > 0)
            {
                eligible = false; score -= 100;
                reasons.Add(Reason("required-labels-missing",
                    $"Missing required labels: {string.Join(", ", missingLabels)}",
                    $"缺少岗位所需标签：{string.Join("、", missingLabels)}", "conflict"));
            }
            if (preferredRoles.Contains(shift.RoleKey))
            {
                score += 30;
                reasons.Add(Reason("preferred-role", "This role is in the member's preferences.", "这个岗位符合成员填写的偏好。", "positive"));
            }
            var memberHistory = history.Where(x => x.MemberId == member.MemberId).ToArray();
            var recentAssignmentCount = memberHistory.Length;
            var pastSameRoleCount = memberHistory.Count(x => x.RoleKey == shift.RoleKey);
            var consecutiveServiceWeeks = CountConsecutiveServiceWeeks(memberHistory.Select(x => x.EndUtc), shift.StartUtc);
            var lastAssignedUtc = memberHistory.OrderByDescending(x => x.EndUtc).Select(x => (DateTime?)x.EndUtc).FirstOrDefault();
            if (recentAssignmentCount == 0)
            {
                score += 20;
                reasons.Add(Reason("no-recent-service", "No confirmed service assignment in this group during the past 180 days.", "近 180 天内没有已确认的服事安排。", "positive"));
            }
            else
            {
                score -= Math.Min(48, recentAssignmentCount * 12);
                reasons.Add(Reason("recent-service-load",
                    $"{recentAssignmentCount} confirmed service assignment(s) in this group during the past 180 days.",
                    $"近 180 天内已有 {recentAssignmentCount} 次已确认的服事安排。", "info"));
            }
            if (pastSameRoleCount > 0)
            {
                score += Math.Min(20, pastSameRoleCount * 5);
                reasons.Add(Reason("same-role-experience",
                    $"Served in this role {pastSameRoleCount} time(s) in recent similar activities.",
                    $"近期类似活动中曾承担这个岗位 {pastSameRoleCount} 次。", "positive"));
            }
            if (consecutiveServiceWeeks > 0)
            {
                score -= Math.Min(40, consecutiveServiceWeeks * 10);
                reasons.Add(Reason("consecutive-service-weeks",
                    $"The member has served for {consecutiveServiceWeeks} consecutive week(s) immediately before this activity.",
                    $"成员在本次活动前已连续服事 {consecutiveServiceWeeks} 周。", "info"));
            }
            if (OverlapsUnavailableWindow(selfWindows, localStart, localEnd))
            {
                eligible = false; score -= 100;
                reasons.Add(Reason("self-unavailable", "The shift overlaps a self-reported unavailable time.", "班次与成员本人填写的不可用时间冲突。", "conflict"));
            }
            if (OverlapsUnavailableWindow(managerWindows, localStart, localEnd))
            {
                eligible = false; score -= 100;
                reasons.Add(Reason("manager-confirmed-unavailable", "The shift overlaps a manager-assisted time constraint confirmed by the member.", "班次与成员已经确认的代录时间限制冲突。", "conflict"));
            }
            var sameDayAssignments = existing.Count(x => x.MemberId == member.MemberId
                && TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(x.StartUtc, DateTimeKind.Utc), timeZone).Date == localStart.Date);
            var overlapsExisting = existing.Any(x => x.MemberId == member.MemberId
                && x.StartUtc < shift.EndUtc && x.EndUtc > shift.StartUtc);
            if (overlapsExisting)
            {
                eligible = false; score -= 100;
                reasons.Add(Reason("assignment-overlap", "The member already has an overlapping confirmed assignment.", "成员已有时间重叠的安排。", "conflict"));
            }
            var dailyLimit = profile?.MaxAssignmentsPerDay ?? 1;
            if (sameDayAssignments >= dailyLimit)
            {
                eligible = false; score -= 80;
                reasons.Add(Reason("daily-limit", "The member's daily assignment limit has been reached.", "成员当天可承担的安排数量已达上限。", "conflict"));
            }
            else if (sameDayAssignments == 0)
                reasons.Add(Reason("no-other-assignment", "No other confirmed assignment on this event day.", "活动当天没有其他已确认安排。", "positive"));
            else score -= sameDayAssignments * 15;
            if (reasons.Count == 0)
                reasons.Add(Reason("no-conflict", "No recorded scheduling conflict.", "没有发现已记录的排班冲突。", "positive"));
            return new RosterCandidateSuggestionDto(
                member.MemberId, member.DisplayName, score, eligible, reasons,
                recentAssignmentCount, pastSameRoleCount, consecutiveServiceWeeks, lastAssignedUtc);
        }).OrderByDescending(x => x.Eligible).ThenByDescending(x => x.Score).ThenBy(x => x.DisplayName).ToArray();
    }

    private static bool OverlapsUnavailableWindow(
        IEnumerable<SchedulingUnavailableWindowDto> windows, DateTime localStart, DateTime localEnd) =>
        windows.Any(window =>
            window.DaysOfWeek.Contains((int)localStart.DayOfWeek)
            && TimeOnly.TryParse(window.StartLocalTime, out var windowStart)
            && TimeOnly.TryParse(window.EndLocalTime, out var windowEnd)
            && TimeOnly.FromDateTime(localStart) < windowEnd
            && TimeOnly.FromDateTime(localEnd) > windowStart);

    private static RosterSuggestionReasonDto Reason(string code, string en, string zh, string severity) =>
        new(code, new Events.Dtos.WorkflowTextDto(en, zh), severity);

    private static int CountConsecutiveServiceWeeks(IEnumerable<DateTime> serviceDatesUtc, DateTime targetUtc)
    {
        static DateTime WeekStart(DateTime value)
        {
            var date = value.Date;
            var daysSinceMonday = ((int)date.DayOfWeek + 6) % 7;
            return date.AddDays(-daysSinceMonday);
        }
        var servedWeeks = serviceDatesUtc.Select(WeekStart).ToHashSet();
        var expectedWeek = WeekStart(targetUtc).AddDays(-7);
        var count = 0;
        while (servedWeeks.Contains(expectedWeek))
        {
            count++;
            expectedWeek = expectedWeek.AddDays(-7);
        }
        return count;
    }

    private sealed record CandidateMember(Guid MemberId, string DisplayName);
    private sealed record CurrentAssignment(
        Guid ShiftId, Guid MemberId, EventRosterAssignmentStatus Status, DateTime StartUtc, DateTime EndUtc);
    private sealed record HistoryAssignment(Guid MemberId, string RoleKey, DateTime EndUtc);
}
