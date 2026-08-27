using Alife.Application.Admin.Dtos;
using System.Text.Json;

namespace Alife.Application.Admin;

public static class AdminPermissionCatalog
{
    public const string AccessAdmin = "admin.access";
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
    public const string SponsorEvents = "admin.events.sponsor";
    public const string ManageEventTemplates = "admin.events.manageTemplates";
    public const string SyncSermons = "admin.sermons.sync";
    public const string RefreshCloudflareCache = "admin.cloudflareCache.refresh";
    public const string ViewDiagnostics = "admin.diagnostics.view";

    private static readonly IReadOnlyList<AdminFeaturePermissionDto> AllPermissions =
    [
        Permission(AccessAdmin, "Administer all group workspaces", "管理全部小组工作区", "Treats this role as a platform administrator in group authorization. This is broader than opening the management menu.", "在小组授权中将该角色视为平台管理员；权限范围远大于仅进入管理菜单。"),
        Permission(ViewMembers, "View members", "查看成员", "View church membership, account state, management duties, and group participation in member management.", "在成员管理中查看教会成员资格、账号状态、管理职能和所在小组。"),
        Permission(ManageMemberProfiles, "Edit member profiles", "编辑成员资料", "Edit member names, preferred address, and gender.", "修改成员姓名、称谓和性别。"),
        Permission(AssignPlatformRoles, "Assign platform roles to members", "为成员分配平台角色", "Assign or remove platform roles. Admin and System Admin assignments remain specially protected.", "分配或移除平台角色；管理员和系统管理员的分配仍受额外保护。"),
        Permission(ViewGroups, "View the platform group directory", "查看平台小组目录", "View groups across the platform in administrative selectors and reports.", "在管理选择器和报表中查看全平台小组。"),
        Permission(ManageRolePermissions, "Manage roles and permissions", "管理角色与权限", "Create custom roles, edit their permissions, and delete unused custom roles.", "创建自定义角色、调整其权限，并删除未使用的自定义角色。"),
        Permission(ManageMessages, "Manage member notifications", "管理成员通知", "Send member notifications and review delivery, read, and reply status.", "发送成员通知，并查看送达、已读和回复状态。"),
        Permission(ReceiveVisitorContactRequests, "Manage visitor care requests", "管理访客接待请求", "View visitor contact requests and update their follow-up status.", "查看访客联系请求并更新跟进状态。"),
        Permission(ViewFiles, "View the platform file registry", "查看平台文件登记", "Review registered uploads across all groups, owners, purposes, and visibility levels.", "按小组、归属、用途和可见范围查看全平台已登记上传文件。"),
        Permission(BackfillPrivateFiles, "Migrate member-private file storage", "迁移成员私有文件存储", "Run the sensitive migration that moves legacy member-private files into private storage.", "执行敏感迁移，将旧的成员私有文件移入私有存储。"),
        Permission(ViewAuditLogs, "View administrative audit logs", "查看管理审计日志", "Review recorded platform-level administrative changes and actors.", "查看已记录的平台级管理变更和操作人员。"),
        Permission(ReviewPages, "Review homepage publication", "审核首页内容发布", "Review public page submissions and manage homepage navigation and publication metadata.", "审核公开页面提交，并管理首页导航和发布信息。"),
        Permission(AuditEvents, "Review event risk assessments", "审核活动风险评估", "View restricted event RAM details and approve submitted assessments.", "查看受限的活动 RAM 详情并批准已提交的评估。"),
        Permission(SponsorEvents, "Decide church event sponsorship", "决定教会活动赞助", "Approve or reject formal root-church sponsorship for an event without granting unrelated administration access.", "批准或拒绝活动的根教会正式赞助，但不授予其他管理权限。"),
        Permission(ManageEventTemplates, "Manage event templates", "管理活动模板", "Create, edit, activate, and deactivate the platform event templates available under the four fixed event categories.", "在四个固定活动分类下创建、编辑、启用及停用平台活动模板。"),
        Permission(SyncSermons, "Synchronize sermons", "同步讲道", "Run a manual synchronization from configured sermon sources.", "从已配置的讲道来源执行手动同步。"),
        Permission(RefreshCloudflareCache, "Refresh shared edge caches", "刷新共享边缘缓存", "Invalidate shared Cloudflare caches for an approved church or group scope.", "使获准教会或小组范围内的 Cloudflare 共享缓存失效。"),
        Permission(ViewDiagnostics, "View cache diagnostics", "查看缓存诊断", "Open the cache diagnostics inspector outside local development.", "在本地开发环境之外打开缓存诊断检查器。")
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

    private static AdminFeaturePermissionDto Permission(
        string code,
        string nameEn,
        string nameZh,
        string descriptionEn,
        string descriptionZh)
        => new(
            code,
            new Dictionary<string, string> { ["en"] = nameEn, ["zh"] = nameZh },
            new Dictionary<string, string> { ["en"] = descriptionEn, ["zh"] = descriptionZh });
}
