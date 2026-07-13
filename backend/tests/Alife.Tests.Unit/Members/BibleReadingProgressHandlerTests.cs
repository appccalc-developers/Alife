using Alife.Application.Common.Models;
using Alife.Application.Members.Commands.SaveBibleReadingProgress;
using Alife.Application.Members.Queries.GetBibleReadingProgress;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Members;

public class BibleReadingProgressHandlerTests
{
    [Fact]
    public async Task SaveThenGet_ReturnsCurrentMembersProgress()
    {
        using var dbContext = CreateDbContext();
        var memberId = Guid.NewGuid();
        var saveHandler = new SaveBibleReadingProgressCommandHandler(dbContext);

        var saved = await saveHandler.Handle(
            new SaveBibleReadingProgressCommand(memberId, "rom", 5, "zh", "123", "206"),
            CancellationToken.None);

        var getHandler = new GetBibleReadingProgressQueryHandler(dbContext);
        var loaded = await getHandler.Handle(
            new GetBibleReadingProgressQuery(memberId),
            CancellationToken.None);

        Assert.True(saved.IsSuccess);
        Assert.True(loaded.IsSuccess);
        Assert.Equal("ROM", loaded.Value!.Book);
        Assert.Equal(5, loaded.Value.Chapter);
        Assert.Equal("zh", loaded.Value.Language);
        Assert.Equal("123", loaded.Value.ZhVersion);
        Assert.Equal("206", loaded.Value.EnVersion);
    }

    [Fact]
    public async Task SaveTwice_UpdatesSingleProgressRecord()
    {
        using var dbContext = CreateDbContext();
        var memberId = Guid.NewGuid();
        var handler = new SaveBibleReadingProgressCommandHandler(dbContext);

        await handler.Handle(
            new SaveBibleReadingProgressCommand(memberId, "JHN", 3, "zh", null, null),
            CancellationToken.None);
        await handler.Handle(
            new SaveBibleReadingProgressCommand(memberId, "ACT", 2, "en", null, "206"),
            CancellationToken.None);

        var progress = await dbContext.BibleReadingProgresses.SingleAsync();
        Assert.Equal(memberId, progress.MemberId);
        Assert.Equal("ACT", progress.Book);
        Assert.Equal(2, progress.Chapter);
        Assert.Equal("en", progress.Language);
    }

    [Theory]
    [InlineData("", 1, "zh")]
    [InlineData("ROM", 0, "zh")]
    [InlineData("ROM", 1, "fr")]
    public async Task Save_WithInvalidPosition_ReturnsValidation(
        string book,
        int chapter,
        string language)
    {
        using var dbContext = CreateDbContext();
        var handler = new SaveBibleReadingProgressCommandHandler(dbContext);

        var result = await handler.Handle(
            new SaveBibleReadingProgressCommand(Guid.NewGuid(), book, chapter, language, null, null),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(dbContext.BibleReadingProgresses);
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
