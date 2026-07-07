using Alife.Application.Sermons.Dtos;
using Alife.Application.Sermons.Queries.GetSermonById;
using Alife.Application.Sermons.Queries.GetSermons;
using Alife.Application.Sermons.Services;
using Alife.Application.Common.Models;
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
        var result = await handler.Handle(new GetSermonsQuery(1, 12), CancellationToken.None);

        // Assert: sermons are returned directly from the data source; IYoutubeService is not a dependency of the handler
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!.Items);
        Assert.Equal("Test Sermon", result.Value.Items[0].Title);
    }

    [Fact]
    public async Task Handle_ReturnsEmptyList_WhenNoSermonsExist()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var sermonReadService = CreateSermonReadService(dbContext);
        var handler = new GetSermonsQueryHandler(sermonReadService);

        // Act
        var result = await handler.Handle(new GetSermonsQuery(1, 12), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value!.Items);
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
        var result = await handler.Handle(new GetSermonsQuery(1, 12), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.Items.Count);
        Assert.Equal("2026 05 24 Latest", result.Value.Items[0].Title);
        Assert.Equal("2026 05 03 Older", result.Value.Items[1].Title);
        Assert.Equal("No Date", result.Value.Items[2].Title);
    }

    [Fact]
    public async Task Handle_ReturnsRequestedPageOnly()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        dbContext.Sermons.AddRange(
            new Sermon { Id = Guid.NewGuid(), YoutubeVideoId = "id1", Title = "First", SpeakerName = "S", SortOrder = 1, PreachedAtUtc = new DateTime(2026, 5, 24, 0, 0, 0, DateTimeKind.Utc), SyncedUtc = DateTime.UtcNow },
            new Sermon { Id = Guid.NewGuid(), YoutubeVideoId = "id2", Title = "Second", SpeakerName = "S", SortOrder = 2, PreachedAtUtc = new DateTime(2026, 5, 17, 0, 0, 0, DateTimeKind.Utc), SyncedUtc = DateTime.UtcNow },
            new Sermon { Id = Guid.NewGuid(), YoutubeVideoId = "id3", Title = "Third", SpeakerName = "S", SortOrder = 3, PreachedAtUtc = new DateTime(2026, 5, 10, 0, 0, 0, DateTimeKind.Utc), SyncedUtc = DateTime.UtcNow }
        );
        await dbContext.SaveChangesAsync();

        var sermonReadService = CreateSermonReadService(dbContext);
        var handler = new GetSermonsQueryHandler(sermonReadService);

        // Act
        var result = await handler.Handle(new GetSermonsQuery(2, 2), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.TotalCount);
        Assert.Equal(2, result.Value.Page);
        Assert.Equal(2, result.Value.PageSize);
        Assert.Single(result.Value.Items);
        Assert.Equal("Third", result.Value.Items[0].Title);
    }

    [Fact]
    public async Task GetById_ReturnsSermon_WhenItExists()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var sermonId = Guid.NewGuid();
        dbContext.Sermons.Add(new Sermon
        {
            Id = sermonId,
            YoutubeVideoId = "id1",
            Title = "Single Sermon",
            SpeakerName = "Speaker",
            SyncedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var sermonReadService = CreateSermonReadService(dbContext);
        var handler = new GetSermonByIdQueryHandler(sermonReadService);

        // Act
        var result = await handler.Handle(new GetSermonByIdQuery(sermonId), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Single Sermon", result.Value!.Title);
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_WhenItDoesNotExist()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var sermonReadService = CreateSermonReadService(dbContext);
        var handler = new GetSermonByIdQueryHandler(sermonReadService);

        // Act
        var result = await handler.Handle(new GetSermonByIdQuery(Guid.NewGuid()), CancellationToken.None);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.NotFound, result.Status);
    }

    private static ISermonReadService CreateSermonReadService(AlifeDbContext dbContext)
    {
        var sermonReadService = Substitute.For<ISermonReadService>();
        sermonReadService.GetSermonsAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            var page = Math.Max(1, call.ArgAt<int>(0));
            var pageSize = Math.Clamp(call.ArgAt<int>(1), 1, 30);
            var orderedQuery = dbContext.Sermons
                .AsNoTracking()
                .OrderBy(x => x.PreachedAtUtc == null)
                .ThenByDescending(x => x.PreachedAtUtc)
                .ThenBy(x => x.SortOrder);
            var totalCount = orderedQuery.Count();
            var items = orderedQuery
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new SermonDto(
                    x.Id,
                    x.Title,
                    x.SpeakerName,
                    x.ThumbnailUrl,
                    x.VideoUrl,
                    x.PreachedAtUtc))
                .ToList();

            return new PagedResult<SermonDto>(items, page, pageSize, totalCount);
        });

        sermonReadService.GetSermonByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            var sermonId = call.ArgAt<Guid>(0);
            return dbContext.Sermons
                .AsNoTracking()
                .Where(x => x.Id == sermonId)
                .Select(x => new SermonDto(
                    x.Id,
                    x.Title,
                    x.SpeakerName,
                    x.ThumbnailUrl,
                    x.VideoUrl,
                    x.PreachedAtUtc))
                .FirstOrDefault();
        });

        return sermonReadService;
    }
}
