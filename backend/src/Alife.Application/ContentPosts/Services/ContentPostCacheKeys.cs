namespace Alife.Application.ContentPosts.Services;

public static class ContentPostCacheKeys
{
    public static string PublicIndex(Guid groupId) => $"content-posts:public:{groupId}";
    public static string PublicDetail(Guid groupId, string slug) => $"content-posts:public:{groupId}:{slug}";
}
