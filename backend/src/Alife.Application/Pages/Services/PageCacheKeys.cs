namespace Alife.Application.Pages.Services;

public static class PageCacheKeys
{
    public static string Public() => "pages:public";
    public static string Detail(Guid pageId) => $"pages:detail:{pageId}";
    public static string PublishedDetail(Guid pageId) => $"pages:published-detail:{pageId}";
    public static string GroupPages(Guid groupId) => $"pages:group:{groupId}";
}
