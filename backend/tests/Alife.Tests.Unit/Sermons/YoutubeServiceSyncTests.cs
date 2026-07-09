using System.Net;
using System.Text;
using Alife.Application.Sermons.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Integrations;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace Alife.Tests.Unit.Sermons;

public class YoutubeServiceSyncTests
{
    [Fact]
    public async Task SyncSermonsAsync_WhenOnlySyncedUtcChanges_DoesNotInvalidateCache()
    {
        using var dbContext = CreateInMemoryDbContext();
        var originalUpdatedUtc = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        dbContext.Sermons.Add(new Sermon
        {
            Id = Guid.NewGuid(),
            YoutubeVideoId = "video-1",
            Title = "Sunday Sermon",
            SpeakerName = "Speaker One",
            ThumbnailUrl = "https://img.example/video-1.jpg",
            VideoUrl = "https://www.youtube.com/watch?v=video-1",
            PreachedAtUtc = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            SortOrder = 0,
            SyncedUtc = originalUpdatedUtc,
            UpdatedUtc = originalUpdatedUtc,
        });
        await dbContext.SaveChangesAsync();

        var cacheInvalidationService = CreateCacheInvalidationService();
        var service = CreateService(dbContext, cacheInvalidationService, CreatePlaylistJson(
            "video-1",
            "Sunday Sermon",
            "Speaker One",
            "https://img.example/video-1.jpg",
            "2026-07-01T00:00:00Z"));

        await service.SyncSermonsAsync();

        await cacheInvalidationService.DidNotReceive().RemoveAllAsync(Arg.Any<CancellationToken>());
        var sermon = await dbContext.Sermons.IgnoreQueryFilters().SingleAsync(x => x.YoutubeVideoId == "video-1");
        Assert.True(sermon.SyncedUtc > originalUpdatedUtc);
        Assert.Equal(originalUpdatedUtc, sermon.UpdatedUtc);
    }

    [Fact]
    public async Task SyncSermonsAsync_WhenNewSermonIsAdded_InvalidatesCache()
    {
        using var dbContext = CreateInMemoryDbContext();
        var cacheInvalidationService = CreateCacheInvalidationService();
        var service = CreateService(dbContext, cacheInvalidationService, CreatePlaylistJson(
            "video-1",
            "Sunday Sermon",
            "Speaker One",
            "https://img.example/video-1.jpg",
            "2026-07-01T00:00:00Z"));

        await service.SyncSermonsAsync();

        await cacheInvalidationService.Received(1).RemoveAllAsync(Arg.Any<CancellationToken>());
        var sermon = await dbContext.Sermons.SingleAsync();
        Assert.Equal("video-1", sermon.YoutubeVideoId);
    }

    [Fact]
    public async Task SyncSermonsAsync_WhenTitleStartsWithDate_UsesTitleDateAtTwentyTwoUtc()
    {
        using var dbContext = CreateInMemoryDbContext();
        var cacheInvalidationService = CreateCacheInvalidationService();
        var service = CreateService(dbContext, cacheInvalidationService, CreatePlaylistJson(
            "video-1",
            "2026-07-01 Sunday Sermon",
            "Speaker One",
            "https://img.example/video-1.jpg",
            "2026-07-03T00:00:00Z"));

        await service.SyncSermonsAsync();

        var sermon = await dbContext.Sermons.SingleAsync();
        Assert.Equal(new DateTime(2026, 7, 1, 22, 0, 0, DateTimeKind.Utc), sermon.PreachedAtUtc);
    }

    [Fact]
    public async Task SyncSermonsAsync_WhenTitleIsShort_UsesPublishedAt()
    {
        using var dbContext = CreateInMemoryDbContext();
        var cacheInvalidationService = CreateCacheInvalidationService();
        var service = CreateService(dbContext, cacheInvalidationService, CreatePlaylistJson(
            "video-1",
            "Short",
            "Speaker One",
            "https://img.example/video-1.jpg",
            "2026-07-01T00:00:00Z"));

        await service.SyncSermonsAsync();

        var sermon = await dbContext.Sermons.SingleAsync();
        Assert.Equal(new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc), sermon.PreachedAtUtc);
    }

    private static YoutubeService CreateService(
        AlifeDbContext dbContext,
        ISermonCacheInvalidationService cacheInvalidationService,
        string playlistJson)
    {
        var httpClientFactory = Substitute.For<IHttpClientFactory>();
        httpClientFactory.CreateClient("youtube").Returns(new HttpClient(new StubHttpMessageHandler(playlistJson))
        {
            BaseAddress = new Uri("https://www.googleapis.com/youtube/v3/")
        });

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["YOUTUBE_API_KEY"] = "test-key",
                ["YOUTUBE_PLAYLIST_ID"] = "playlist-1",
            })
            .Build();

        return new YoutubeService(
            dbContext,
            httpClientFactory,
            configuration,
            NullLogger<YoutubeService>.Instance,
            cacheInvalidationService);
    }

    private static ISermonCacheInvalidationService CreateCacheInvalidationService()
    {
        var cacheInvalidationService = Substitute.For<ISermonCacheInvalidationService>();
        cacheInvalidationService.RemoveAllAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        return cacheInvalidationService;
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static string CreatePlaylistJson(
        string videoId,
        string title,
        string speakerName,
        string thumbnailUrl,
        string publishedAt)
        => $$"""
        {
          "items": [
            {
              "snippet": {
                "publishedAt": "{{publishedAt}}",
                "title": "{{title}}",
                "channelTitle": "CCAC",
                "videoOwnerChannelTitle": "{{speakerName}}",
                "resourceId": {
                  "videoId": "{{videoId}}"
                },
                "thumbnails": {
                  "default": {
                    "url": "{{thumbnailUrl}}"
                  }
                }
              }
            }
          ]
        }
        """;

    private sealed class StubHttpMessageHandler(string responseJson) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson, Encoding.UTF8, "application/json")
            });
        }
    }
}
