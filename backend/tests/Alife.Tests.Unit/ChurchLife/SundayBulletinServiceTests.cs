using Alife.Application.ChurchLife;
using Alife.Api.Controllers;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Services;
using Alife.Application.FileAssets.Commands.RegisterFileAsset;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Tests.Unit.ChurchLife;

public sealed class SundayBulletinServiceTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MissingStorageConfigurationReturns503BeforeAnyObjectOrMetadataWrite(bool missingSigningSecret)
    {
        await using var db = CreateDb();
        var church = new Group { Id = Guid.NewGuid(), IsChurch = true, NameJson = "{}" };
        db.Groups.Add(church);
        await db.SaveChangesAsync();
        var member = Guid.NewGuid();
        var auth = Substitute.For<IGroupAuthorizationService>();
        auth.IsRegisteredMemberAsync(member, default).Returns(true);
        auth.IsApprovedMemberAsync(church.Id, member, default).Returns(true);
        auth.IsLeaderOrCoLeaderAsync(church.Id, member, default).Returns(true);
        var providers = Substitute.For<IFileStorageProviderResolver>();
        var provider = new FileStorageProviderOptions(null, "cloudflare-r2",
            FileStorageProviderKind.CloudflareR2, "ccalc", null, "https://files.test", "https://files.test", "", "private", false, true, true);
        providers.GetDefaultAsync(default).Returns(provider);
        providers.GetByCodeAsync(provider.Code, default).Returns(provider);
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FileAssets:PrivateFileSigningSecret"] = missingSigningSecret ? null : "test-only-signing-secret-not-for-production",
        }).Build();
        using var handler = new RejectNetworkHandler();
        using var client = new HttpClient(handler);
        var storage = new SundayBulletinStorage(client, configuration);
        var signer = new FileAssetAccessUrlSigner(configuration, providers);
        var service = new SundayBulletinService(db, auth, providers, signer, storage);
        var date = (await service.ListAsync(member, default)).Value!.Items[0].Date;
        var result = await service.UploadAsync(member, date, "耶穌，耶穌_樂譜.pdf", "%PDF-test"u8.ToArray(), default);
        Assert.Equal(AppResultStatus.ServiceUnavailable, result.Status);
        Assert.Equal("Bulletin storage is unavailable. Please contact a church administrator.", result.Message);
        Assert.Equal(0, handler.Requests);
        Assert.Empty(db.FileAssets);
        var controller = new SundayBulletinsController(service, Substitute.For<ICurrentMemberAccessor>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
        Assert.Equal(503, Assert.IsType<ObjectResult>(controller.ToActionResult(result)).StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task UpstreamTimeoutReturns503ButCallerCancellationPropagates(bool callerCancels)
    {
        await using var db = CreateDb();
        using var cancellation = new CancellationTokenSource();
        var church = new Group { Id = Guid.NewGuid(), IsChurch = true, NameJson = "{}" };
        db.Groups.Add(church);
        await db.SaveChangesAsync();
        var member = Guid.NewGuid();
        var auth = Substitute.For<IGroupAuthorizationService>();
        auth.IsRegisteredMemberAsync(member, Arg.Any<CancellationToken>()).Returns(true);
        auth.IsApprovedMemberAsync(church.Id, member, Arg.Any<CancellationToken>()).Returns(true);
        auth.IsLeaderOrCoLeaderAsync(church.Id, member, Arg.Any<CancellationToken>()).Returns(true);
        var providers = Substitute.For<IFileStorageProviderResolver>();
        var provider = new FileStorageProviderOptions(null, "cloudflare-r2", FileStorageProviderKind.CloudflareR2,
            "ccalc", null, "https://files.test", "https://files.test", "", "private", false, true, true);
        providers.GetDefaultAsync(Arg.Any<CancellationToken>()).Returns(provider);
        var signer = Substitute.For<IFileAssetAccessUrlSigner>();
        signer.CreatePrivateReadUrlAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns("https://files.test/signed");
        var storage = Substitute.For<ISundayBulletinStorage>();
        storage.UploadAsync(provider, Arg.Any<string>(), Arg.Any<byte[]>(), Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (callerCancels) cancellation.Cancel();
            return Task.FromException(new OperationCanceledException("request stopped"));
        });
        var service = new SundayBulletinService(db, auth, providers, signer, storage);
        var date = (await service.ListAsync(member, default)).Value!.Items[0].Date;
        Task<AppResult<bool>> Upload() => service.UploadAsync(member, date, "bulletin.pdf", "%PDF-test"u8.ToArray(), cancellation.Token);
        if (callerCancels)
            await Assert.ThrowsAsync<OperationCanceledException>(Upload);
        else
            Assert.Equal(AppResultStatus.ServiceUnavailable, (await Upload()).Status);
        Assert.Empty(db.FileAssets);
    }

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
        Assert.Equal(AppResultStatus.ServiceUnavailable, (await service.UploadAsync(member, date, "failed.pdf", "%PDF-test"u8.ToArray(), default)).Status);
        Assert.Equal("replacement.pdf", file.OriginalFileName);
        signer.CreatePrivateReadUrlAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<TimeSpan>(), default)
            .Returns(Task.FromException<string>(new InvalidOperationException("Private file signing secret is not configured.")));
        Assert.Equal(AppResultStatus.ServiceUnavailable, (await service.OpenAsync(member, date, default)).Status);
        auth.IsApprovedMemberAsync(church.Id, member, default).Returns(false);
        Assert.Equal(AppResultStatus.Forbidden, (await service.OpenAsync(member, date, default)).Status);
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);

    private sealed class RejectNetworkHandler : HttpMessageHandler
    {
        public int Requests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests++;
            throw new InvalidOperationException("Unexpected network request during configuration validation.");
        }
    }
}
