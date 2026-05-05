namespace Alife.Application.Common.Sync;

public static class SyncKeys
{
    public static string Member(Guid memberId) => $"member:{memberId:N}:v";

    public static string Group(Guid groupId) => $"group:{groupId:N}:v";

    public static string GroupTree(Guid groupId) => $"group:{groupId:N}:tree:v";

    public static string GroupMemberships(Guid groupId) => $"group:{groupId:N}:memberships:v";

    public static string GroupPages(Guid groupId, string language) => $"group:{groupId:N}:pages:{NormalizeLanguage(language)}:v";

    public static string Page(Guid pageId) => $"page:{pageId:N}:v";

    public static string PageSlug(string slug, string language) => $"page-slug:{NormalizeSlug(slug)}:{NormalizeLanguage(language)}:v";

    public static string GlobalPages(string language) => $"pages:global:{NormalizeLanguage(language)}:v";

    private static string NormalizeLanguage(string language) => language.Trim().ToLowerInvariant();

    private static string NormalizeSlug(string slug) => slug.Trim().ToLowerInvariant();
}
