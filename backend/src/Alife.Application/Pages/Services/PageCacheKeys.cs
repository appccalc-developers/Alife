namespace Alife.Application.Pages.Services;

public static class PageCacheKeys
{
    public static string Global() => "pages:global";
    public static string Public() => "pages:public";
    public static string Detail(Guid pageId) => $"pages:detail:{pageId}";
    public static string GroupPages(Guid groupId) => $"pages:group:{groupId}";
}
