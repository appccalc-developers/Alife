using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public static class EventProgrammePolicy
{
    public const string ModuleKey = "programme";

    public static bool IsEnabled(GroupEvent groupEvent) =>
        EventCompositionFactory.UsesOptionalModule(groupEvent.EventDataJson, ModuleKey);

    public static async Task<GroupEvent?> GetManagedEventAsync(
        IAlifeDbContext db,
        IGroupAuthorizationService authorization,
        Guid eventId,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .FirstOrDefaultAsync(x => x.Id == eventId, cancellationToken);
        return groupEvent is not null
            && await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, memberId, cancellationToken)
                ? groupEvent
                : null;
    }

    public static EventModuleStatus ModuleStatus(IEnumerable<EventProgrammeItem> items)
    {
        var list = items.OrderBy(x => x.StartUtc).ThenBy(x => x.SortOrder).ToArray();
        if (list.Length == 0) return EventModuleStatus.NotConfigured;
        if (list.Any(x => x.Status == EventProgrammeItemStatus.Ready && !CanBeReady(x)))
            return EventModuleStatus.Blocked;
        return list.All(x => x.Status is EventProgrammeItemStatus.Ready or EventProgrammeItemStatus.Completed && CanBeReady(x))
            ? EventModuleStatus.Ready
            : EventModuleStatus.Configuring;
    }

    public static bool CanBeReady(EventProgrammeItem item) =>
        item.EndUtc > item.StartUtc
        && (!string.IsNullOrWhiteSpace(item.TitleEn) || !string.IsNullOrWhiteSpace(item.TitleZh))
        && (item.OwnerMemberId.HasValue || HasAcceptedRosterOwner(item))
        && (!item.RequiresHandover
            || !string.IsNullOrWhiteSpace(item.HandoverEn)
            || !string.IsNullOrWhiteSpace(item.HandoverZh));

    public static bool HasAcceptedRosterOwner(EventProgrammeItem item) =>
        item.RosterShift?.Assignments.Any(x => x.Status == EventRosterAssignmentStatus.Accepted) == true;

    public static EventProgrammeItemDto ToDto(EventProgrammeItem item) => new(
        item.Id,
        item.EventOccurrenceId,
        item.RosterShiftId,
        item.OwnerMemberId,
        item.OwnerMember?.DisplayName,
        item.SortOrder,
        item.StartUtc,
        item.EndUtc,
        new WorkflowTextDto(item.TitleEn, item.TitleZh),
        new WorkflowTextDto(item.InstructionsEn, item.InstructionsZh),
        item.RequiresHandover,
        new WorkflowTextDto(item.HandoverEn, item.HandoverZh),
        item.Status,
        CanBeReady(item),
        item.RosterShift is null ? null : new EventProgrammeRosterLinkDto(
            item.RosterShift.Id,
            item.RosterShift.RoleKey,
            new WorkflowTextDto(item.RosterShift.NameEn, item.RosterShift.NameZh),
            item.RosterShift.Assignments
                .Where(x => x.Status != EventRosterAssignmentStatus.Cancelled)
                .OrderBy(x => x.Member.DisplayName)
                .Select(x => new EventProgrammeAssigneeDto(x.MemberId, x.Member.DisplayName ?? "Member", x.Status))
                .ToArray()),
        item.UpdatedUtc);

    public static string Text(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var trimmed = value.Trim();
        return trimmed[..Math.Min(trimmed.Length, maxLength)];
    }
}
