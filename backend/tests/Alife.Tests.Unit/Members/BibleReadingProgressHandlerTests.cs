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

    [Fact]
    public async Task SaveForTwoMembers_UpdatingOneDoesNotChangeTheOthersProgress()
    {
        using var dbContext = CreateDbContext();
        var firstMemberId = Guid.NewGuid();
        var secondMemberId = Guid.NewGuid();
        var saveHandler = new SaveBibleReadingProgressCommandHandler(dbContext);

        var firstSaved = await saveHandler.Handle(
            new SaveBibleReadingProgressCommand(firstMemberId, "JHN", 3, "zh", "123", "206"),
            CancellationToken.None);
        var secondSaved = await saveHandler.Handle(
            new SaveBibleReadingProgressCommand(secondMemberId, "ACT", 4, "en", "46", "111"),
            CancellationToken.None);
        var firstUpdated = await saveHandler.Handle(
            new SaveBibleReadingProgressCommand(firstMemberId, "ROM", 7, "zh", "48", "59"),
            CancellationToken.None);
        dbContext.ChangeTracker.Clear();

        var getHandler = new GetBibleReadingProgressQueryHandler(dbContext);
        var firstLoaded = await getHandler.Handle(
            new GetBibleReadingProgressQuery(firstMemberId),
            CancellationToken.None);
        var secondLoaded = await getHandler.Handle(
            new GetBibleReadingProgressQuery(secondMemberId),
            CancellationToken.None);

        Assert.True(firstSaved.IsSuccess);
        Assert.True(secondSaved.IsSuccess);
        Assert.True(firstUpdated.IsSuccess);
        Assert.True(firstLoaded.IsSuccess);
        Assert.True(secondLoaded.IsSuccess);
        Assert.Equal("ROM", firstLoaded.Value!.Book);
        Assert.Equal(7, firstLoaded.Value.Chapter);
        Assert.Equal("zh", firstLoaded.Value.Language);
        Assert.Equal("48", firstLoaded.Value.ZhVersion);
        Assert.Equal("59", firstLoaded.Value.EnVersion);
        Assert.Equal("ACT", secondLoaded.Value!.Book);
        Assert.Equal(4, secondLoaded.Value.Chapter);
        Assert.Equal("en", secondLoaded.Value.Language);
        Assert.Equal("46", secondLoaded.Value.ZhVersion);
        Assert.Equal("111", secondLoaded.Value.EnVersion);
        Assert.Equal(2, await dbContext.BibleReadingProgresses.CountAsync());
    }

    [Fact]
    public async Task Get_WhenOnlyAnotherMemberHasProgress_ReturnsNotFound()
    {
        using var dbContext = CreateDbContext();
        var memberWithProgress = Guid.NewGuid();
        var memberWithoutProgress = Guid.NewGuid();
        var saveHandler = new SaveBibleReadingProgressCommandHandler(dbContext);
        var saved = await saveHandler.Handle(
            new SaveBibleReadingProgressCommand(memberWithProgress, "JHN", 3, "zh", "123", "206"),
            CancellationToken.None);
        dbContext.ChangeTracker.Clear();

        var getHandler = new GetBibleReadingProgressQueryHandler(dbContext);
        var loaded = await getHandler.Handle(
            new GetBibleReadingProgressQuery(memberWithoutProgress),
            CancellationToken.None);

        Assert.True(saved.IsSuccess);
        Assert.Equal(AppResultStatus.NotFound, loaded.Status);
        Assert.Null(loaded.Value);
        Assert.Equal(memberWithProgress, (await dbContext.BibleReadingProgresses.SingleAsync()).MemberId);
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
