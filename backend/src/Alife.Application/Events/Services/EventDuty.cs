using Alife.Application.Events.Dtos;
using Alife.Application.Notifications.Dtos;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public sealed record EventDuty(CurrentNotificationTaskDto Task, string Surface, string? TargetUrl = null,
    string? DetailText = null, string? ETag = null, LocalizedTextDto? Context = null);

internal static class EventDutyFactory
{
    public static EventDuty Create(GroupEvent e, Guid viewer, string source, Guid id, string version, string action,
        string en, string zh, string surface, DateTime created, DateTime? due = null, Guid? occurrence = null, string? targetUrl = null)
    {
        var key = $"event:{e.Id}:{source}:{id}:{action}:{version}:{viewer}";
        var url = $"/events/{e.Id}/duties/{source}/{id}?taskKey={Uri.EscapeDataString(key)}";
        var data = EventPackageCanonicalizer.Serialize(new {
            title = new LocalizedTextDto($"{en}: {e.TitleEn}", $"{zh}：{e.TitleZh}"),
            body = new LocalizedTextDto("Open the current record to handle this responsibility.", "请打开对应记录处理此项职责。"),
            eventTitle = new LocalizedTextDto(e.TitleEn, e.TitleZh), sourceType = source, sourceId = id, actionUrl = url });
        return new(new(id, viewer, EventDutyAccess.OwnerId(e), e.GroupId, e.Id, created, action, data,
            null, null, null, created, created, null, "urgent", "workflow", url, source, id, key, version, occurrence, due,
            new(en, zh)), surface, targetUrl);
    }

    public static readonly string[] ReplacedNotificationTypes = [
        "event.ram.reviewRequested", "event.ram.confirmationRequested", "event.package.submitted",
        "event.preparation.reopen.request", "event.package.invalidated", "event.package.occurrenceReviewRequired",
        "event.package.condition.evidenceSubmitted", "event.package.condition.rejected", "event.package.condition.expired"
    ];
}
