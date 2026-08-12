using Alife.Application.Admin.Dtos;
using System.Text.Json;

namespace Alife.Application.Admin;

public static class AdminPermissionCatalog
{
    public const string AccessAdmin = "admin.access";
    public const string ViewPlatformOverview = "admin.overview.view";
    public const string ViewMembers = "admin.members.view";
    public const string ManageMemberProfiles = "admin.members.manageProfiles";
    public const string AssignPlatformRoles = "admin.members.assignPlatformRoles";
    public const string ViewGroups = "admin.groups.view";
    public const string ManageRolePermissions = "admin.roles.managePermissions";
    public const string ManageMessages = "admin.messages.manage";
    public const string ReceiveVisitorContactRequests = "admin.visitRequests.receive";
    public const string ViewFiles = "admin.files.view";
    public const string BackfillPrivateFiles = "admin.files.backfill";
    public const string ViewAuditLogs = "admin.auditLogs.view";
    public const string ReviewPages = "admin.pages.review";
    public const string AuditEvents = "admin.events.audit";
    public const string SyncSermons = "admin.sermons.sync";
    public const string RefreshCloudflareCache = "admin.cloudflareCache.refresh";
    public const string ViewDiagnostics = "admin.diagnostics.view";

    private static readonly IReadOnlyList<AdminFeaturePermissionDto> AllPermissions =
    [
        new(AccessAdmin, new Dictionary<string, string> { ["en"] = "Open admin workspace", ["zh"] = "进入管理后台" }),
        new(ViewPlatformOverview, new Dictionary<string, string> { ["en"] = "View platform overview", ["zh"] = "查看平台总览" }),
        new(ViewMembers, new Dictionary<string, string> { ["en"] = "Open member management", ["zh"] = "打开成员管理" }),
        new(ManageMemberProfiles, new Dictionary<string, string> { ["en"] = "Edit member profiles", ["zh"] = "修改成员资料" }),
        new(AssignPlatformRoles, new Dictionary<string, string> { ["en"] = "Assign member roles", ["zh"] = "分配成员角色" }),
        new(ViewGroups, new Dictionary<string, string> { ["en"] = "View group directory", ["zh"] = "查看小组目录" }),
        new(ManageRolePermissions, new Dictionary<string, string> { ["en"] = "Open role management", ["zh"] = "打开角色管理" }),
        new(ManageMessages, new Dictionary<string, string> { ["en"] = "Open notice management", ["zh"] = "打开通知管理" }),
        new(ReceiveVisitorContactRequests, new Dictionary<string, string> { ["en"] = "Receive visitor contact requests", ["zh"] = "接收访客联系请求" }),
        new(ViewFiles, new Dictionary<string, string> { ["en"] = "Open file management", ["zh"] = "打开文件管理" }),
        new(BackfillPrivateFiles, new Dictionary<string, string> { ["en"] = "Backfill private files", ["zh"] = "迁移私有文件" }),
        new(ViewAuditLogs, new Dictionary<string, string> { ["en"] = "Open audit logs", ["zh"] = "打开操作日志" }),
        new(ReviewPages, new Dictionary<string, string> { ["en"] = "Open homepage management", ["zh"] = "打开首页管理" }),
        new(AuditEvents, new Dictionary<string, string> { ["en"] = "Review and approve event RAM", ["zh"] = "审核并批准活动 RAM" }),
        new(SyncSermons, new Dictionary<string, string> { ["en"] = "Run sermon sync", ["zh"] = "执行讲道同步" }),
        new(RefreshCloudflareCache, new Dictionary<string, string> { ["en"] = "Clear edge cache", ["zh"] = "清理边缘缓存" }),
        new(ViewDiagnostics, new Dictionary<string, string> { ["en"] = "View cache diagnostics panel", ["zh"] = "查看缓存诊断面板" })
    ];

    private static readonly IReadOnlySet<string> AllCodes = AllPermissions.Select(x => x.Code).ToHashSet(StringComparer.Ordinal);

    private static readonly IReadOnlyList<string> AdminDefaults = AllCodes
        .Where(code => code is not ManageRolePermissions and not BackfillPrivateFiles)
        .OrderBy(code => code, StringComparer.Ordinal)
        .ToArray();

    public static IReadOnlyList<AdminFeaturePermissionDto> ListAll() => AllPermissions;

    public static IReadOnlyList<string> GetDefaultPermissions(string roleCode)
        => roleCode switch
        {
            "superadmin" => AllCodes.OrderBy(code => code, StringComparer.Ordinal).ToArray(),
            "admin" => AdminDefaults,
            "page_reviewer" => [ReviewPages],
            "visitor_contact_receiver" => [AccessAdmin, ReceiveVisitorContactRequests],
            _ => []
        };

    public static IReadOnlyList<string> NormalizePermissions(IEnumerable<string> permissionCodes)
        => permissionCodes
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Where(code => AllCodes.Contains(code))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(code => code, StringComparer.Ordinal)
            .ToArray();

    public static IReadOnlyList<string> ReadPermissions(string roleCode, string? permissionsJson)
    {
        if (string.IsNullOrWhiteSpace(permissionsJson))
        {
            return GetDefaultPermissions(roleCode);
        }

        try
        {
            var permissions = JsonSerializer.Deserialize<string[]>(permissionsJson);
            return permissions is null
                ? GetDefaultPermissions(roleCode)
                : NormalizePermissions(permissions);
        }
        catch (JsonException)
        {
            return GetDefaultPermissions(roleCode);
        }
    }

    public static string WritePermissions(IEnumerable<string> permissionCodes)
        => JsonSerializer.Serialize(NormalizePermissions(permissionCodes));
}
