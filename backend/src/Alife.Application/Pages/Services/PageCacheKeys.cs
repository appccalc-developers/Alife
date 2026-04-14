namespace Alife.Application.Pages.Services;

public static class PageCacheKeys
{
    public static string Global(string lang) => $"pages:global:{lang}";
    public static string BySlug(string slug, string lang) => $"pages:slug:{lang}:{slug}";
    public static string GroupPages(Guid groupId, string lang) => $"pages:group:{groupId}:{lang}";
}
