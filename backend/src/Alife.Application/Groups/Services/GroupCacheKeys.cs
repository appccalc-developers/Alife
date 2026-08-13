namespace Alife.Application.Groups.Services;

public static class GroupCacheKeys
{
    public static string ById(Guid id) => $"group:{id}";
    public static string Church() => "group:church";
    public static string VisibleDiscoverable() => "groups:visible:discoverable";
    public static string Subgroups(Guid id) => $"group:{id}:subgroups";
    public static string Memberships(Guid id) => $"group:{id}:memberships";
}
