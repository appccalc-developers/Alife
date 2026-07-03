using Alife.Application.Sermons.Dtos;
using Alife.Application.Sermons.Queries.GetSermons;
using Alife.Application.Sermons.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Sermons;

public class GetSermonsQueryHandlerTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    [Fact]
    public async Task Handle_ReturnsSermons_WithoutCallingYoutubeSync()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        dbContext.Sermons.Add(new Sermon
        {
            Id = Guid.NewGuid(),
            YoutubeVideoId = "abc123",
            Title = "Test Sermon",
            SpeakerName = "Speaker One",
            SortOrder = 1,
            SyncedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var sermonReadService = CreateSermonReadService(dbContext);
        var handler = new GetSermonsQueryHandler(sermonReadService);

        // Act
        var result = await handler.Handle(new GetSermonsQuery(), CancellationToken.None);

        // Assert: sermons are returned directly from the data source; IYoutubeService is not a dependency of the handler
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Equal("Test Sermon", result.Value![0].Title);
    }

    [Fact]
    public async Task Handle_ReturnsEmptyList_WhenNoSermonsExist()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var sermonReadService = CreateSermonReadService(dbContext);
        var handler = new GetSermonsQueryHandler(sermonReadService);

        // Act
        var result = await handler.Handle(new GetSermonsQuery(), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value!);
    }

    [Fact]
    public async Task Handle_ReturnsSermons_OrderedByPreachedDateDescending()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        dbContext.Sermons.AddRange(
            new Sermon { Id = Guid.NewGuid(), YoutubeVideoId = "id1", Title = "2026 05 03 Older", SpeakerName = "S", SortOrder = 1, PreachedAtUtc = new DateTime(2026, 5, 3, 0, 0, 0, DateTimeKind.Utc), SyncedUtc = DateTime.UtcNow },
            new Sermon { Id = Guid.NewGuid(), YoutubeVideoId = "id2", Title = "2026 05 24 Latest", SpeakerName = "S", SortOrder = 2, PreachedAtUtc = new DateTime(2026, 5, 24, 0, 0, 0, DateTimeKind.Utc), SyncedUtc = DateTime.UtcNow },
            new Sermon { Id = Guid.NewGuid(), YoutubeVideoId = "id3", Title = "No Date", SpeakerName = "S", SortOrder = 0, SyncedUtc = DateTime.UtcNow }
        );
        await dbContext.SaveChangesAsync();
        var sermonReadService = CreateSermonReadService(dbContext);
        var handler = new GetSermonsQueryHandler(sermonReadService);

        // Act
        var result = await handler.Handle(new GetSermonsQuery(), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.Count);
        Assert.Equal("2026 05 24 Latest", result.Value![0].Title);
        Assert.Equal("2026 05 03 Older", result.Value![1].Title);
        Assert.Equal("No Date", result.Value![2].Title);
    }

    private static ISermonReadService CreateSermonReadService(AlifeDbContext dbContext)
    {
        var sermonReadService = Substitute.For<ISermonReadService>();
        sermonReadService.GetSermonsAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            dbContext.Sermons
                .AsNoTracking()
                .OrderBy(x => x.PreachedAtUtc == null)
                .ThenByDescending(x => x.PreachedAtUtc)
                .ThenBy(x => x.SortOrder)
                .Select(x => new SermonDto(
                    x.Id,
                    x.Title,
                    x.SpeakerName,
                    x.ThumbnailUrl,
                    x.VideoUrl,
                    x.PreachedAtUtc))
                .ToList());

        return sermonReadService;
    }
}
