using System.Net;
using Alife.Application.FileAssets.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GroupFilePurgeTests
{
    [Fact]
    public async Task FailureRetainsQueueAndSuccessRemovesOnlyMarkedFile()
    {
        await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var file = new FileAsset { Id = Guid.NewGuid(), StorageProvider = "test", BucketName = "test", ObjectKey = "groups/11111111-1111-1111-1111-111111111111/file.png",
            IsDeleted = true, RelatedEntityType = "DissolvedGroup", RelatedEntityId = Guid.Parse("11111111-1111-1111-1111-111111111111") };
        var unrelated = new FileAsset { Id = Guid.NewGuid(), IsDeleted = true, ObjectKey = "unrelated.png" };
        db.FileAssets.AddRange(file, unrelated);
        await db.SaveChangesAsync();
        var providers = Substitute.For<IFileStorageProviderResolver>();
        providers.GetByCodeAsync("test", Arg.Any<CancellationToken>()).Returns(new FileStorageProviderOptions(null, "test", FileStorageProviderKind.CloudflareR2,
            "test", null, null, "https://storage.test", "", "", true, true, true));
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["FileAssets:ImageApiAdminSecret"] = "test-secret" }).Build();
        var transport = new Transport();
        var purger = new DissolvedGroupFilePurger(db, new HttpClient(transport), config, providers);
        Assert.Equal(0, await purger.PurgeAsync(default));
        Assert.Equal(2, await db.FileAssets.IgnoreQueryFilters().CountAsync());
        transport.Status = HttpStatusCode.NoContent;
        Assert.Equal(1, await purger.PurgeAsync(default));
        Assert.Equal(unrelated.Id, (await db.FileAssets.IgnoreQueryFilters().SingleAsync()).Id);
        Assert.Single(await db.AuditLogs.ToListAsync());
        Assert.Equal(0, await purger.PurgeAsync(default));
        Assert.Equal(2, transport.Calls);
    }

    private sealed class Transport : HttpMessageHandler
    {
        public HttpStatusCode Status = HttpStatusCode.ServiceUnavailable;
        public int Calls;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            Assert.Equal("https://storage.test/api/admin/file-objects/delete", request.RequestUri!.ToString());
            Assert.Equal("test-secret", request.Headers.GetValues("x-alife-file-admin-secret").Single());
            Assert.Contains("groups/11111111-1111-1111-1111-111111111111/file.png", await request.Content!.ReadAsStringAsync(ct));
            return new HttpResponseMessage(Status);
        }
    }
}
