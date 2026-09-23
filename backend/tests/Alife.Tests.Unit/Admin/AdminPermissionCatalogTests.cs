using Alife.Application.Admin;

namespace Alife.Tests.Unit.Admin;

public class AdminPermissionCatalogTests
{
    [Fact]
    public void EventPermissions_AreExplicitAndDoNotTurnScopedRolesIntoPlatformGrants()
    {
        var permissions = AdminPermissionCatalog.ListAll();
        Assert.Equal(new[] {
            "admin.events.approvePackages", "admin.events.audit", "admin.events.managePackagePolicies",
            "admin.events.manageRamPolicies", "admin.events.manageTemplates", "admin.events.sponsor"
        }, permissions.Where(x => x.Code.StartsWith("admin.events.", StringComparison.Ordinal)).Select(x => x.Code).OrderBy(x => x, StringComparer.Ordinal));
        Assert.DoesNotContain(permissions, x => x.Code is "event.package.decide" or "event.accountableOwner" or "registration.manager");
        var policy = Assert.Single(permissions, x => x.Code == AdminPermissionCatalog.ManageEventPackagePolicies);
        Assert.Contains("delegation", policy.Description["en"]);
        Assert.Contains("委派", policy.Description["zh"]);
    }

    [Fact]
    public void ListAll_ContainsOnlyUniqueLocalizedEffectivePermissions()
    {
        var permissions = AdminPermissionCatalog.ListAll();

        Assert.NotEmpty(permissions);
        Assert.Equal(
            permissions.Count,
            permissions.Select(permission => permission.Code).Distinct(StringComparer.Ordinal).Count());
        Assert.All(permissions, permission =>
        {
            Assert.False(string.IsNullOrWhiteSpace(permission.Name["en"]));
            Assert.False(string.IsNullOrWhiteSpace(permission.Name["zh"]));
            Assert.False(string.IsNullOrWhiteSpace(permission.Description["en"]));
            Assert.False(string.IsNullOrWhiteSpace(permission.Description["zh"]));
        });
    }

    [Fact]
    public void BackfillPrivateFiles_IsDelegatableButNotGrantedToDefaultAdmin()
    {
        Assert.Contains(
            AdminPermissionCatalog.ListAll(),
            permission => permission.Code == AdminPermissionCatalog.BackfillPrivateFiles);
        Assert.DoesNotContain(
            AdminPermissionCatalog.BackfillPrivateFiles,
            AdminPermissionCatalog.GetDefaultPermissions("admin"));
        Assert.Contains(
            AdminPermissionCatalog.BackfillPrivateFiles,
            AdminPermissionCatalog.GetDefaultPermissions("superadmin"));
    }
}
