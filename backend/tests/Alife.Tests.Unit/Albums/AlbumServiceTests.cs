using Alife.Application.Albums;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Albums;

public sealed class AlbumServiceTests
{
    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public async Task List_HidesMemberAlbumsFromAnonymousVisitors()
    {
        await using var db = CreateDb();
        var groupId = Guid.NewGuid();
        db.Groups.Add(new Group { Id = groupId, NameJson = "{}" });
        db.Albums.AddRange(
            Album(groupId, "Public", AlbumVisibility.Public),
            Album(groupId, "Members", AlbumVisibility.GroupVisible));
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();

        var result = await new AlbumService(db, authorization).ListAsync(groupId, null, true, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Equal("Public", result.Value![0].Name["en"]);
    }

    [Fact]
    public async Task GetPublicAlbum_HidesMemberOnlyChildFromAnonymousVisitors()
    {
        await using var db = CreateDb();
        var groupId = Guid.NewGuid();
        var parent = Album(groupId, "Public", AlbumVisibility.Public);
        var publicChild = Album(groupId, "Public child", AlbumVisibility.Public, parent.Id);
        var memberChild = Album(groupId, "Member child", AlbumVisibility.GroupVisible, parent.Id);
        db.Groups.Add(new Group { Id = groupId, NameJson = "{}" });
        db.Albums.AddRange(parent, publicChild, memberChild);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();

        var result = await new AlbumService(db, authorization).GetAsync(parent.Id, null, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!.Children);
        Assert.Equal(publicChild.Id, result.Value.Children[0].Id);
        Assert.Equal(1, result.Value.Album.ChildCount);
    }

    [Fact]
    public async Task GetMemberAlbum_AllowsApprovedReadOnlyMemberWithoutManagementActions()
    {
        await using var db = CreateDb();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var album = Album(groupId, "Members", AlbumVisibility.GroupVisible);
        db.Groups.Add(new Group { Id = groupId, NameJson = "{}" });
        db.Albums.Add(album);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);
        authorization.IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(false);

        var result = await new AlbumService(db, authorization).GetAsync(album.Id, memberId, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.CanManage);
    }

    [Fact]
    public async Task CreateAlbum_RejectsApprovedReadOnlyMember()
    {
        await using var db = CreateDb();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        db.Groups.Add(new Group { Id = groupId, NameJson = "{}" });
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(false);
        var input = new CreateAlbumInput(groupId, null, new Dictionary<string, string> { ["en"] = "Read only" }, null, AlbumVisibility.GroupVisible);

        var result = await new AlbumService(db, authorization).CreateAsync(input, memberId, CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Empty(db.Albums);
    }

    private static Album Album(Guid groupId, string name, AlbumVisibility visibility, Guid? parentId = null) => new()
    {
        Id = Guid.NewGuid(), GroupId = groupId, ParentAlbumId = parentId,
        NameJson = "{\"en\":\"" + name + "\"}", Visibility = visibility,
        CreatedByMemberId = Guid.NewGuid(), CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };
}
