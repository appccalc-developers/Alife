using Alife.Application.Albums;
using Alife.Application.Common.Models;
using Alife.Application.Common.Interfaces;
using Alife.Application.Abstractions.Identity;
using Alife.Application.FileAssets.Commands.RegisterFileAsset;
using Alife.Api.Controllers;
using Alife.Application.FileAssets.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace Alife.Tests.Unit.Albums;

public sealed class AlbumPhotoServiceTests
{
    private static readonly AlbumPhotoContent Image = new(Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGMQz44Sz45igFAAFxIDcXHULXQAAAAASUVORK5CYII="), "image/png");
    private readonly Guid group = Guid.NewGuid(), actor = Guid.NewGuid(), albumId = Guid.NewGuid();
    private readonly IAlbumPhotoStorage storage = Substitute.For<IAlbumPhotoStorage>();
    private readonly IFileStorageProviderResolver providers = Substitute.For<IFileStorageProviderResolver>();
    private static readonly FileStorageProviderOptions Provider = new(null, "test", FileStorageProviderKind.CloudflareR2, "test", null, null, "https://storage.invalid", "", "private/", true, true, true);

    private async Task<AlifeDbContext> Setup(MembershipRole role = MembershipRole.Leader, MembershipStatus status = MembershipStatus.Approved, bool admin = false)
    {
        var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Groups.Add(new Group { Id = group, NameJson = "{}" });
        db.Albums.Add(new Album { Id = albumId, GroupId = group, NameJson = "{}", Visibility = AlbumVisibility.GroupVisible });
        db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = group, MemberId = actor, Role = role, Status = status });
        if (admin)
        {
            var platform = new PlatformRole { Id = 999, Code = "superadmin" };
            db.MemberPlatformRoles.Add(new MemberPlatformRole { Id = Guid.NewGuid(), MemberId = actor, Role = platform, RoleId = platform.Id });
        }
        await db.SaveChangesAsync();
        providers.GetDefaultAsync(Arg.Any<CancellationToken>()).Returns(Provider);
        providers.GetByCodeAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(Provider);
        storage.ReadAsync(Arg.Any<FileStorageProviderOptions>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(_ => new AlbumPhotoDownload(new MemoryStream(Image.Bytes), Image.ContentType));
        return db;
    }
    private AlbumPhotoService Service(AlifeDbContext db) => new(db, new GroupAuthorizationService(db), providers, storage, NullLogger<AlbumPhotoService>.Instance);

    [Theory]
    [InlineData(MembershipRole.Leader, MembershipStatus.Approved, false, true)]
    [InlineData(MembershipRole.CoLeader, MembershipStatus.Approved, false, true)]
    [InlineData(MembershipRole.Member, MembershipStatus.Approved, false, false)]
    [InlineData(MembershipRole.Leader, MembershipStatus.Requested, false, false)]
    [InlineData(MembershipRole.CoLeader, MembershipStatus.Removed, false, false)]
    [InlineData(MembershipRole.Member, MembershipStatus.Approved, true, true)]
    public async Task Upload_EnforcesRealRoleAndStatus(MembershipRole role, MembershipStatus status, bool admin, bool allowed)
    {
        await using var db = await Setup(role, status, admin);
        var result = await Service(db).UploadAsync(albumId, actor, Guid.NewGuid(), AlbumVisibility.GroupVisible, "photo.png", Image, default);
        Assert.Equal(allowed, result.IsSuccess);
        Assert.Equal(allowed ? 1 : 0, await db.AlbumPhotos.CountAsync());
        if (!allowed) await storage.DidNotReceiveWithAnyArgs().UploadAsync(default!, default!, default!, default);
    }

    [Fact]
    public async Task Upload_IsIdempotentAndRejectsChangedPayloadOrCrossGroup()
    {
        await using var db = await Setup();
        var service = Service(db); var id = Guid.NewGuid();
        Assert.True((await service.UploadAsync(albumId, actor, id, AlbumVisibility.GroupVisible, "one.png", Image, default)).IsSuccess);
        Assert.True((await service.UploadAsync(albumId, actor, id, AlbumVisibility.GroupVisible, "one.png", Image, default)).IsSuccess);
        Assert.Single(db.AlbumPhotos);
        Assert.StartsWith($"private/groups/{group}/albums/{albumId}/", db.FileAssets.Single().ObjectKey);
        Assert.Null(db.FileAssets.Single().PublicUrl);
        await storage.Received(1).UploadAsync(Arg.Any<FileStorageProviderOptions>(), Arg.Any<string>(), Arg.Any<AlbumPhotoContent>(), Arg.Any<CancellationToken>());
        var another = Guid.NewGuid();
        db.Albums.Add(new Album { Id = another, GroupId = Guid.NewGuid(), NameJson = "{}" }); await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await service.UploadAsync(another, actor, id, AlbumVisibility.GroupVisible, "one.png", Image, default)).Status);
        Assert.Equal(AppResultStatus.Conflict, (await service.UploadAsync(albumId, actor, Guid.NewGuid(), AlbumVisibility.Public, "one.png", Image, default)).Status);
    }

    [Fact]
    public async Task Read_RechecksMembershipVisibilityAndDeletionWithoutBearerLinks()
    {
        await using var db = await Setup(); var service = Service(db); var id = Guid.NewGuid();
        await service.UploadAsync(albumId, actor, id, AlbumVisibility.GroupVisible, "photo.png", Image, default);
        Assert.True((await service.ReadAsync(id, actor, default)).IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, (await service.ReadAsync(id, null, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.ReadAsync(id, Guid.NewGuid(), default)).Status);
        var membership = await db.GroupMemberships.SingleAsync(); membership.Status = MembershipStatus.Removed; await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await service.ReadAsync(id, actor, default)).Status);
        var album = await db.Albums.SingleAsync(); album.Visibility = AlbumVisibility.Public;
        db.FileAssets.Single().Visibility = FileAssetVisibility.Public; await db.SaveChangesAsync();
        Assert.True((await service.ReadAsync(id, null, default)).IsSuccess);
        album.Visibility = AlbumVisibility.GroupVisible; await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await service.ReadAsync(id, null, default)).Status);
        db.FileAssets.Single().IsDeleted = true; await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.NotFound, (await service.ReadAsync(id, actor, default)).Status);
    }

    [Fact]
    public async Task Upload_RevokedDuringTransfer_CleansOnlyItsOwnObject()
    {
        await using var db = await Setup();
        storage.UploadAsync(Arg.Any<FileStorageProviderOptions>(), Arg.Any<string>(), Arg.Any<AlbumPhotoContent>(), Arg.Any<CancellationToken>()).Returns(async _ => {
            db.GroupMemberships.Single().Status = MembershipStatus.Removed; await db.SaveChangesAsync();
        });
        var result = await Service(db).UploadAsync(albumId, actor, Guid.NewGuid(), AlbumVisibility.GroupVisible, "photo.png", Image, default);
        Assert.Equal(AppResultStatus.Conflict, result.Status); Assert.Empty(db.FileAssets);
        await storage.Received(1).DeleteAsync(Arg.Any<FileStorageProviderOptions>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Read_LegacyAlbumObjectAndCoverUseProtectedEndpoint()
    {
        await using var db = await Setup(); var id = Guid.NewGuid();
        await Service(db).UploadAsync(albumId, actor, id, AlbumVisibility.GroupVisible, "photo.png", Image, default);
        var asset = db.FileAssets.Single(); asset.ObjectKey = $"groups/{group}/albums/{albumId}/legacy.png"; asset.PublicUrl = "https://storage.invalid/legacy.png"; await db.SaveChangesAsync();
        Assert.True((await Service(db).ReadAsync(id, actor, default)).IsSuccess);
        var detail = await new AlbumService(db, new GroupAuthorizationService(db)).GetAsync(albumId, actor, default);
        Assert.Equal(AlbumPhotoService.Url(id), detail.Value!.Album.CoverUrl);
        Assert.Equal(AlbumPhotoService.Url(id), detail.Value.Photos.Single().Url);
    }

    [Fact]
    public async Task Demotion_UpdatesFileMetadataAndRemovalDeletesThroughServerStorage()
    {
        await using var db = await Setup(); var id = Guid.NewGuid();
        var album = db.Albums.Single(); album.Visibility = AlbumVisibility.Public; await db.SaveChangesAsync();
        await Service(db).UploadAsync(albumId, actor, id, AlbumVisibility.Public, "photo.png", Image, default);
        var albums = new AlbumService(db, new GroupAuthorizationService(db), storage, providers, NullLogger<AlbumService>.Instance);
        Assert.True((await albums.UpdateAsync(albumId, new(new Dictionary<string, string> { ["en"] = "Fictional album" }, null, AlbumVisibility.GroupVisible), actor, default)).IsSuccess);
        Assert.Equal(FileAssetVisibility.GroupVisible, db.FileAssets.Single().Visibility);
        var photoId = db.AlbumPhotos.Single().Id;
        Assert.True((await albums.RemovePhotoAsync(albumId, photoId, actor, default)).IsSuccess);
        Assert.Empty(db.AlbumPhotos);
        await storage.Received(1).DeleteAsync(Arg.Any<FileStorageProviderOptions>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void Validation_RejectsDisguisedTruncatedOversizedAndUnsupportedFiles()
    {
        Assert.True(AlbumPhotoValidation.IsValid(Image.Bytes, "image/png"));
        Assert.False(AlbumPhotoValidation.IsValid(Image.Bytes, "image/jpeg"));
        Assert.False(AlbumPhotoValidation.IsValid(Image.Bytes[..30], "image/png"));
        Assert.False(AlbumPhotoValidation.IsValid("<svg onload='x'/>"u8.ToArray(), "image/png"));
        Assert.False(AlbumPhotoValidation.IsValid(new byte[AlbumPhotoService.MaxBytes + 1], "image/png"));
    }

    [Fact]
    public async Task Controller_ReturnsBytesOrDenialWithNoStorageForBothPublicAndPrivate()
    {
        await using var db = await Setup(); var id = Guid.NewGuid();
        await Service(db).UploadAsync(albumId, actor, id, AlbumVisibility.GroupVisible, "photo.png", Image, default);
        var accessor = Substitute.For<ICurrentMemberAccessor>();
        var controller = new AlbumPhotosController(Service(db), accessor) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
        var denied = await controller.Read(id, default);
        Assert.Equal(403, Assert.IsType<ObjectResult>(denied).StatusCode);
        Assert.Contains("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
        db.Albums.Single().Visibility = AlbumVisibility.Public; db.FileAssets.Single().Visibility = FileAssetVisibility.Public; await db.SaveChangesAsync();
        await using var bytes = Assert.IsType<FileStreamResult>(await controller.Read(id, default)).FileStream;
        using var read = new MemoryStream(); await bytes.CopyToAsync(read); Assert.Equal(Image.Bytes, read.ToArray());
        Assert.Contains("no-store", controller.Response.Headers.CacheControl.ToString());
        var file = new FormFile(new MemoryStream(Image.Bytes), 0, Image.Bytes.Length, "file", "photo.png") { Headers = new HeaderDictionary(), ContentType = "image/png" };
        Assert.IsType<UnauthorizedResult>(await controller.Upload(albumId, file, Guid.NewGuid(), AlbumVisibility.Public, default));
    }

    [Theory]
    [InlineData(FileAssetPurpose.AlbumPhoto)]
    [InlineData(FileAssetPurpose.General)]
    public async Task GenericRegistration_CannotReclassifyAnAlbumObject(FileAssetPurpose purpose)
    {
        await using var db = await Setup();
        var request = new RegisterFileAssetCommand(actor, "test", null, $"groups/{group}/albums/{albumId}/original.png", "https://untrusted.invalid/public.png",
            "original.png", "original.png", "image/png", Image.Bytes.Length, null, null, FileAssetVisibility.Public, purpose, group, actor, "album", albumId);
        var result = await new RegisterFileAssetCommandHandler(db, new GroupAuthorizationService(db), providers).Handle(request, default);
        Assert.Equal(AppResultStatus.Forbidden, result.Status); Assert.Empty(db.FileAssets);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FailedDatabaseSave_CleansOnlyUncommittedObjects(bool committedBeforeError)
    {
        await using var db = await Setup();
        var proxy = Substitute.For<IAlifeDbContext>();
        proxy.Albums.Returns(db.Albums); proxy.AlbumPhotos.Returns(db.AlbumPhotos); proxy.FileAssets.Returns(db.FileAssets);
        proxy.SaveChangesAsync(Arg.Any<CancellationToken>()).Returns(async _ => {
            if (committedBeforeError) await db.SaveChangesAsync();
            return await Task.FromException<int>(new IOException("Synthetic database failure"));
        });
        var service = new AlbumPhotoService(proxy, new GroupAuthorizationService(db), providers, storage, NullLogger<AlbumPhotoService>.Instance);
        var id = Guid.NewGuid();
        await Assert.ThrowsAsync<IOException>(() => service.UploadAsync(albumId, actor, id, AlbumVisibility.GroupVisible, "photo.png", Image, default));
        if (committedBeforeError)
        {
            await storage.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default!, default);
            Assert.True((await Service(db).UploadAsync(albumId, actor, id, AlbumVisibility.GroupVisible, "photo.png", Image, default)).IsSuccess);
        }
        else await storage.Received(1).DeleteAsync(Arg.Any<FileStorageProviderOptions>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}
