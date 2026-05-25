namespace Alife.Application.Events.Services;

public static class EventCacheKeys
{
    public static string GroupEvents(Guid groupId) => $"group:{groupId}:events";
}
