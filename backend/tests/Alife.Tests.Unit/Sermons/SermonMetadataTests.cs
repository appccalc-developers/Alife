using Alife.Application.Sermons.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Sermons;

public sealed class SermonMetadataTests
{
    [Theory]
    [InlineData("2026 05 24 主日证道 與主連結 | 講員: 吳誠牧師", "與主連結", "吳誠牧師", "2026-05-24")]
    [InlineData("2026-5-24 主日證道：與主連結 — 讲员：吴诚牧师", "與主連結", "吴诚牧师", "2026-05-24")]
    [InlineData("2026年5月24日 主日庆典 直播：认识你里面的基督 2", "认识你里面的基督 2", "", "2026-05-24")]
    [InlineData("2024/02/29 Sunday Sermon Hope | Speaker: Jane Smith", "Hope", "Jane Smith", "2024-02-29")]
    [InlineData("2026-02-30 主日证道 盼望 | 讲员：吴牧师", "盼望", "吴牧师", "2026-06-28")]
    [InlineData("Short", "Short", "", "2026-06-28")]
    public void ParsesTitleSpeakerAndCalendarDate(string raw, string title, string speaker, string date)
    {
        var parsed = SermonMetadata.Parse(raw, new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc));
        Assert.Equal(title, parsed.Title);
        Assert.Equal(speaker, parsed.SpeakerName);
        Assert.Equal(DateOnly.Parse(date), DateOnly.FromDateTime(parsed.PreachedAtUtc!.Value));
        Assert.Equal(0, parsed.PreachedAtUtc.Value.Hour);
    }

    [Theory]
    [InlineData("2026-06-28T00:00:00Z", "2026-06-21")]
    [InlineData("2026-06-27T13:00:00Z", "2026-06-21")]
    [InlineData("2026-06-29T00:00:00Z", "2026-06-28")]
    [InlineData("2026-01-01T00:00:00Z", "2025-12-28")]
    public void FallbackUsesSundayStrictlyBeforeAucklandPublicationDate(string published, string expected)
    {
        var parsed = SermonMetadata.Parse("Hope", DateTime.Parse(published).ToUniversalTime());
        Assert.Equal(DateOnly.Parse(expected), DateOnly.FromDateTime(parsed.PreachedAtUtc!.Value));
    }

    [Fact]
    public async Task BackfillIncludesArchivedEntitiesPreservesIdentityAndOnlyRunsOnce()
    {
        using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var id = Guid.NewGuid();
        var archivedId = Guid.NewGuid();
        db.Sermons.AddRange(
            new Sermon { Id = id, YoutubeVideoId = "video-1", Title = "2026 05 24 主日证道 與主連結 | 講員: 吳誠牧師", SpeakerName = "豐盛生命教會", PreachedAtUtc = new DateTime(2026, 5, 25) },
            new Sermon { Id = archivedId, YoutubeVideoId = "video-2", Title = "Hope", SpeakerName = "Church", PreachedAtUtc = new DateTime(2026, 7, 1), IsDeleted = true });
        await db.SaveChangesAsync();
        var cache = Substitute.For<ISermonCacheInvalidationService>();
        Assert.Equal(2, await SermonMetadataBackfill.RunAsync(db, cache));
        Assert.Equal(0, await SermonMetadataBackfill.RunAsync(db, cache));
        var sermon = await db.Sermons.SingleAsync();
        Assert.Equal(id, sermon.Id);
        Assert.Equal("video-1", sermon.YoutubeVideoId);
        Assert.Equal("與主連結", sermon.Title);
        Assert.Equal("吳誠牧師", sermon.SpeakerName);
        Assert.StartsWith("2026 05 24", sermon.SourceTitle);
        var archived = await db.Sermons.IgnoreQueryFilters().SingleAsync(s => s.Id == archivedId);
        Assert.True(archived.IsDeleted);
        Assert.Equal(new DateTime(2026, 6, 28), archived.PreachedAtUtc);
        Assert.Equal(string.Empty, archived.SpeakerName);
        await cache.Received(1).RemoveAllAsync(Arg.Any<CancellationToken>());
    }
}
