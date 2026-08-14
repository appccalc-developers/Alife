using Alife.Application.Admin;

namespace Alife.Tests.Unit.Admin;

public class AdminPermissionCatalogTests
{
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
