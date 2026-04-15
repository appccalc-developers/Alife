using Alife.Application.Sermons.Queries.GetSermons;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

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

        var handler = new GetSermonsQueryHandler(dbContext);

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
        var handler = new GetSermonsQueryHandler(dbContext);

        // Act
        var result = await handler.Handle(new GetSermonsQuery(), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value!);
    }

    [Fact]
    public async Task Handle_ReturnsSermons_OrderedBySortOrderThenByPreachedAtDescending()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var olderDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var newerDate = new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        dbContext.Sermons.AddRange(
            new Sermon { Id = Guid.NewGuid(), YoutubeVideoId = "id1", Title = "Older", SpeakerName = "S", SortOrder = 1, PreachedAtUtc = olderDate, SyncedUtc = DateTime.UtcNow },
            new Sermon { Id = Guid.NewGuid(), YoutubeVideoId = "id2", Title = "Newer", SpeakerName = "S", SortOrder = 1, PreachedAtUtc = newerDate, SyncedUtc = DateTime.UtcNow }
        );
        await dbContext.SaveChangesAsync();
        var handler = new GetSermonsQueryHandler(dbContext);

        // Act
        var result = await handler.Handle(new GetSermonsQuery(), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.Count);
        Assert.Equal("Newer", result.Value![0].Title);
        Assert.Equal("Older", result.Value![1].Title);
    }
}
