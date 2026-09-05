using Alife.Application.ChurchLife;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Services;
using Alife.Application.FileAssets.Commands.RegisterFileAsset;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Tests.Unit.ChurchLife;

public sealed class SundayBulletinServiceTests
{
    [Theory]
    [InlineData(FileAssetPurpose.General, "private/sunday-bulletins/church/date.pdf")]
    [InlineData(FileAssetPurpose.SundayBulletin, "public/date.pdf")]
    public async Task GenericRegistrationCannotForgeOrModifyBulletins(FileAssetPurpose purpose, string key)
    {
        await using var db = CreateDb();
        var handler = new RegisterFileAssetCommandHandler(db, Substitute.For<IGroupAuthorizationService>(), Substitute.For<IFileStorageProviderResolver>());
        var result = await handler.Handle(new RegisterFileAssetCommand(Guid.NewGuid(), "local-dev", null, key,
            null, "date.pdf", "date.pdf", "application/pdf", 10, null, null, FileAssetVisibility.Public,
            purpose, null, null, null, null), default);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(db.FileAssets);
    }

    [Fact]
    public async Task ControllerRejectsAnonymousAndSetsPrivateNoStore()
    {
        var controller = new SundayBulletinsController(null!, Substitute.For<ICurrentMemberAccessor>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
        Assert.NotNull(typeof(SundayBulletinsController).GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
        Assert.IsType<UnauthorizedResult>(await controller.List(default));
        Assert.IsType<UnauthorizedResult>(await controller.Open(default, default));
        Assert.IsType<UnauthorizedResult>(await controller.Upload(default, null!, default));
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
    }

    [Theory]
    [InlineData("2026-09-05", "2026-09-06", "2026-06-07")]
    [InlineData("2026-09-06", "2026-09-06", "2026-06-07")]
    [InlineData("2026-09-07", "2026-09-13", "2026-06-07")]
    [InlineData("2024-05-31", "2024-06-02", "2024-03-03")]
    public void DatesIncludeUpcomingSundayAndThreeCalendarMonths(string today, string first, string last)
    {
        var dates = SundayBulletinService.Dates(DateOnly.Parse(today));
        Assert.Equal(DateOnly.Parse(first), dates[0]);
        Assert.Equal(DateOnly.Parse(last), dates[^1]);
        Assert.All(dates, date => Assert.Equal(DayOfWeek.Sunday, date.DayOfWeek));
        Assert.Equal(dates.Count, dates.Distinct().Count());
    }

    [Theory]
    [InlineData(false, false, false)]
    [InlineData(true, false, false)]
    [InlineData(true, true, false)]
    [InlineData(true, true, true)]
    public async Task EnforcesReadAndWritePermissions(bool registered, bool approved, bool manager)
    {
        await using var db = CreateDb();
        var church = new Group { Id = Guid.NewGuid(), IsChurch = true, NameJson = "{}" };
        db.Groups.Add(church);
        await db.SaveChangesAsync();
        var member = Guid.NewGuid();
        var auth = Substitute.For<IGroupAuthorizationService>();
        auth.IsRegisteredMemberAsync(member, default).Returns(registered);
        auth.IsApprovedMemberAsync(church.Id, member, default).Returns(approved);
        auth.IsLeaderOrCoLeaderAsync(church.Id, member, default).Returns(manager);
        var providers = Substitute.For<IFileStorageProviderResolver>();
        var provider = new FileStorageProviderOptions(null, "local-dev", FileStorageProviderKind.LocalDev, "test", null, "https://files.test", "https://files.test", "", "private", false, true, false);
        providers.GetDefaultAsync(default).Returns(provider);
        providers.GetByCodeAsync("local-dev", default).Returns(provider);
        var storage = Substitute.For<ISundayBulletinStorage>();
        var signer = Substitute.For<IFileAssetAccessUrlSigner>();
        signer.CreatePrivateReadUrlAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<TimeSpan>(), default).Returns("https://files.test/signed");
        var service = new SundayBulletinService(db, auth, providers, signer, storage);
        var list = await service.ListAsync(member, default);
        Assert.Equal(registered && approved, list.IsSuccess);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Pacific/Auckland")));
        var date = SundayBulletinService.Dates(today)[0];
        var result = await service.UploadAsync(member, date, "bulletin.pdf", "%PDF-first"u8.ToArray(), default);
        Assert.Equal(registered && manager, result.IsSuccess);
        if (!result.IsSuccess)
        {
            await storage.DidNotReceiveWithAnyArgs().UploadAsync(default!, default!, default!, default);
            Assert.Equal(registered && approved ? AppResultStatus.NotFound : AppResultStatus.Forbidden,
                (await service.OpenAsync(member, date, default)).Status);
            return;
        }
        Assert.True((await service.ListAsync(member, default)).Value!.Items[0].HasFile);
        var id = (await db.FileAssets.SingleAsync()).Id;
        Assert.True((await service.UploadAsync(member, date, "replacement.pdf", "%PDF-second"u8.ToArray(), default)).IsSuccess);
        var file = await db.FileAssets.SingleAsync();
        Assert.Equal(id, file.Id);
        Assert.Null(file.PublicUrl);
        Assert.Equal(FileAssetVisibility.GroupVisible, file.Visibility);
        Assert.Equal("replacement.pdf", file.OriginalFileName);
        Assert.True((await service.OpenAsync(member, date, default)).IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, (await service.UploadAsync(member, date, "bad.pdf", "invalid"u8.ToArray(), default)).Status);
        Assert.Equal(AppResultStatus.ValidationError, (await service.UploadAsync(member, date.AddDays(1), "ok.pdf", "%PDF-test"u8.ToArray(), default)).Status);
        storage.UploadAsync(provider, file.ObjectKey, Arg.Any<byte[]>(), default).Returns(Task.FromException(new HttpRequestException("offline")));
        await Assert.ThrowsAsync<HttpRequestException>(() => service.UploadAsync(member, date, "failed.pdf", "%PDF-test"u8.ToArray(), default));
        Assert.Equal("replacement.pdf", file.OriginalFileName);
        auth.IsApprovedMemberAsync(church.Id, member, default).Returns(false);
        Assert.Equal(AppResultStatus.Forbidden, (await service.OpenAsync(member, date, default)).Status);
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);
}
