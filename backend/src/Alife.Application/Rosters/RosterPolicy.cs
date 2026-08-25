using System.Globalization;
using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters;

public static class RosterPolicy
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string NormalizeKey(string value) => new(value.Trim().ToLowerInvariant()
        .Where(character => char.IsLetterOrDigit(character) || character is '-' or '_').ToArray());

    public static string[] NormalizeTags(IEnumerable<string>? values) => (values ?? [])
        .Select(NormalizeKey).Where(x => x.Length > 0).Distinct(StringComparer.Ordinal).Take(30).ToArray();

    public static string Write<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);
    public static T[] Read<T>(string? json)
    {
        try { return JsonSerializer.Deserialize<T[]>(json ?? "[]", JsonOptions) ?? []; }
        catch (JsonException) { return []; }
    }

    public static bool TryValidateWindows(
        IReadOnlyList<SchedulingUnavailableWindowDto>? windows,
        out SchedulingUnavailableWindowDto[] normalized,
        out string error)
    {
        var result = new List<SchedulingUnavailableWindowDto>();
        foreach (var window in windows ?? [])
        {
            var days = window.DaysOfWeek.Distinct().OrderBy(x => x).ToArray();
            if (days.Length == 0 || days.Any(x => x is < 0 or > 6))
            {
                normalized = []; error = "Each unavailable window needs at least one valid day."; return false;
            }
            if (!TimeOnly.TryParseExact(window.StartLocalTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start)
                || !TimeOnly.TryParseExact(window.EndLocalTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end)
                || end <= start)
            {
                normalized = []; error = "Unavailable times must use HH:mm and end after start."; return false;
            }
            result.Add(new SchedulingUnavailableWindowDto(days, start.ToString("HH:mm"), end.ToString("HH:mm"), Truncate(window.Reason, 300)));
        }
        normalized = result.Take(50).ToArray(); error = string.Empty; return true;
    }

    public static string Truncate(string? value, int max) => string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim()[..Math.Min(value.Trim().Length, max)];

    public static SchedulingUnavailableWindowDto[] ReadWindowsForRoster(string? json) =>
        Read<SchedulingUnavailableWindowDto>(json)
            .Select(x => new SchedulingUnavailableWindowDto(x.DaysOfWeek, x.StartLocalTime, x.EndLocalTime, string.Empty))
            .ToArray();

    public static async Task<GroupEvent?> GetManagedEventAsync(
        IAlifeDbContext db, Alife.Application.Groups.Services.IGroupAuthorizationService authorization,
        Guid eventId, Guid memberId, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, cancellationToken);
        return groupEvent is not null && await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, memberId, cancellationToken)
            ? groupEvent : null;
    }

    public static RosterShiftDto ToDto(EventRosterShift shift) => new(
        shift.Id, shift.RoleKey, new WorkflowTextDto(shift.NameEn, shift.NameZh), shift.StartUtc, shift.EndUtc,
        shift.RequiredPeople, Read<string>(shift.RequiredLabelsJson), shift.Notes,
        shift.Assignments.OrderBy(x => x.Member.DisplayName).Select(x => new RosterAssignmentDto(
            x.Id, x.MemberId, x.Member.DisplayName ?? "Member", x.Status, x.BasedOnSmartSuggestion,
            x.ConfirmationNotes, x.ConfirmedUtc, x.MemberResponseNotes, x.RespondedUtc)).ToArray());

    public static EventModuleStatus RosterModuleStatus(IEnumerable<EventRosterShift> shifts)
    {
        var list = shifts.ToArray();
        if (list.Length == 0) return EventModuleStatus.NotConfigured;
        return list.All(x => x.Assignments.Count(a => a.Status == EventRosterAssignmentStatus.Accepted) >= x.RequiredPeople)
            ? EventModuleStatus.Ready : EventModuleStatus.Configuring;
    }

    public static ManagerSchedulingProfileDto ReadManagerProfile(string? json, DateTime? managerUpdatedUtc = null)
    {
        if (string.IsNullOrWhiteSpace(json))
            return EmptyManagerProfile();
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind == JsonValueKind.Array)
            {
                var legacyLabels = JsonSerializer.Deserialize<string[]>(json, JsonOptions) ?? [];
                var hasLegacyData = legacyLabels.Length > 0 || managerUpdatedUtc.HasValue;
                return new ManagerSchedulingProfileDto(
                    NormalizeTags(legacyLabels), [], hasLegacyData ? "confirmed" : "notSet",
                    hasLegacyData ? "legacy" : string.Empty, managerUpdatedUtc, null, []);
            }
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                return EmptyManagerProfile();
            var stored = JsonSerializer.Deserialize<ManagerSchedulingProfileDto>(json, JsonOptions);
            if (stored is null) return EmptyManagerProfile();
            return stored with
            {
                Labels = NormalizeTags(stored.Labels),
                UnavailableWindows = (stored.UnavailableWindows ?? [])
                    .Select(x => new SchedulingUnavailableWindowDto(x.DaysOfWeek, x.StartLocalTime, x.EndLocalTime, string.Empty))
                    .ToArray(),
                ConfirmationStatus = NormalizeManagerConfirmationStatus(stored.ConfirmationStatus),
                ConfirmationMethod = NormalizeManagerConfirmationMethod(stored.ConfirmationMethod),
                Qualifications = NormalizeQualifications(stored.Qualifications)
            };
        }
        catch (JsonException)
        {
            return EmptyManagerProfile();
        }
    }

    public static string WriteManagerProfile(ManagerSchedulingProfileDto profile) => Write(profile);

    public static ManagerQualificationDto[] NormalizeQualifications(IEnumerable<ManagerQualificationDto>? values) =>
        (values ?? [])
            .Select(x => new ManagerQualificationDto(NormalizeKey(x.Key), x.ValidUntilUtc))
            .Where(x => x.Key.Length > 0)
            .GroupBy(x => x.Key, StringComparer.Ordinal)
            .Select(x => x.OrderByDescending(item => item.ValidUntilUtc).First())
            .Take(30)
            .ToArray();

    public static bool IsManagerProfileUsable(ManagerSchedulingProfileDto profile, DateTime nowUtc) =>
        profile.ConfirmationStatus == "confirmed"
        && (!profile.ReviewDueUtc.HasValue || profile.ReviewDueUtc.Value > nowUtc);

    public static string NormalizeManagerConfirmationStatus(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "confirmed" => "confirmed",
        "pending" => "pending",
        _ => "notSet"
    };

    public static string NormalizeManagerConfirmationMethod(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "inperson" => "inPerson",
        "phone" => "phone",
        "memberportal" => "memberPortal",
        "authorizedcarer" => "authorizedCarer",
        "legacy" => "legacy",
        _ => string.Empty
    };

    private static ManagerSchedulingProfileDto EmptyManagerProfile() =>
        new([], [], "notSet", string.Empty, null, null, []);

    public static bool IsEnabled(GroupEvent groupEvent)
        => EventCompositionFactory.UsesOptionalModule(groupEvent.EventDataJson, "roster");
}
