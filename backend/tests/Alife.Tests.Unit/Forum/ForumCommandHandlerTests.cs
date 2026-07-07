using Alife.Application.Forum.Commands.CreateForumComment;
using Alife.Application.Forum.Commands.CreateForumPost;
using Alife.Application.Forum.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using System.Text.Json;

namespace Alife.Tests.Unit.Forum;

public class ForumCommandHandlerTests
{
	private static AlifeDbContext CreateInMemoryDbContext()
	{
		var options = new DbContextOptionsBuilder<AlifeDbContext>()
			.UseInMemoryDatabase(Guid.NewGuid().ToString())
			.Options;
		return new AlifeDbContext(options);
	}

	[Fact]
	public async Task CreatePost_WhenOnlyChineseContentProvided_CreatesPost()
	{
		using var dbContext = CreateInMemoryDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var memberId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		dbContext.Members.Add(CreateMember(memberId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		await dbContext.SaveChangesAsync();
		authorization.CanWriteSiteForumAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
		var handler = new CreateForumPostCommandHandler(dbContext, authorization);

		var result = await handler.Handle(
			new CreateForumPostCommand(
				memberId,
				categoryId,
				GroupId: null,
				new Dictionary<string, string> { ["zh"] = "代祷事项" },
				new Dictionary<string, string> { ["zh"] = "请大家为周五团契祷告。" },
				Media: null,
				Visibility: ForumPostVisibility.MembersOnly),
			CancellationToken.None);

		Assert.True(result.IsSuccess);
		Assert.NotNull(result.Value);
		var title = JsonSerializer.Deserialize<Dictionary<string, string>>(result.Value.TitleJson);
		Assert.Equal("代祷事项", title?["zh"]);
		Assert.False(title!.ContainsKey("en"));
		Assert.Equal(1, await dbContext.ForumPosts.CountAsync());
	}

	[Fact]
	public async Task CreatePost_WhenNoLanguageContentProvided_ReturnsValidation()
	{
		using var dbContext = CreateInMemoryDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var handler = new CreateForumPostCommandHandler(dbContext, authorization);

		var result = await handler.Handle(
			new CreateForumPostCommand(
				Guid.NewGuid(),
				Guid.NewGuid(),
				GroupId: null,
				new Dictionary<string, string> { ["zh"] = " " },
				new Dictionary<string, string> { ["en"] = "Body" },
				Media: null,
				Visibility: ForumPostVisibility.MembersOnly),
			CancellationToken.None);

		Assert.False(result.IsSuccess);
		Assert.Equal(Alife.Application.Common.Models.AppResultStatus.ValidationError, result.Status);
	}

	[Fact]
	public async Task CreatePost_WhenMemberIsNotRegistered_ReturnsForbidden()
	{
		using var dbContext = CreateInMemoryDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var memberId = Guid.NewGuid();
		authorization.CanWriteSiteForumAsync(memberId, Arg.Any<CancellationToken>()).Returns(false);
		var handler = new CreateForumPostCommandHandler(dbContext, authorization);

		var result = await handler.Handle(
			new CreateForumPostCommand(
				memberId,
				Guid.NewGuid(),
				GroupId: null,
				new Dictionary<string, string> { ["en"] = "Title" },
				new Dictionary<string, string> { ["en"] = "Body" },
				Media: null,
				Visibility: ForumPostVisibility.MembersOnly),
			CancellationToken.None);

		Assert.False(result.IsSuccess);
		Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, result.Status);
	}

	[Fact]
	public async Task CreateComment_WhenPostIsLocked_ReturnsForbidden()
	{
		using var dbContext = CreateInMemoryDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var memberId = Guid.NewGuid();
		var authorId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var postId = Guid.NewGuid();
		dbContext.Members.AddRange(CreateMember(memberId), CreateMember(authorId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.Add(new ForumPost
		{
			Id = postId,
			CategoryId = categoryId,
			AuthorMemberId = authorId,
			TitleJson = "{\"en\":\"Title\"}",
			BodyJson = "{\"en\":\"Body\"}",
			Visibility = ForumPostVisibility.MembersOnly,
			IsLocked = true,
			CreatedUtc = DateTime.UtcNow,
			UpdatedUtc = DateTime.UtcNow
		});
		await dbContext.SaveChangesAsync();
		var handler = new CreateForumCommentCommandHandler(dbContext, authorization);

		var result = await handler.Handle(
			new CreateForumCommentCommand(
				postId,
				memberId,
				ParentCommentId: null,
				Body: new Dictionary<string, string> { ["zh"] = "收到" },
				Media: null),
			CancellationToken.None);

		Assert.False(result.IsSuccess);
		Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, result.Status);
		Assert.Equal(0, await dbContext.ForumComments.CountAsync());
	}

	private static Member CreateMember(Guid id) =>
		new()
		{
			Id = id,
			DisplayName = "Forum Member",
			IsRegistered = true,
			CreatedUtc = DateTime.UtcNow,
			UpdatedUtc = DateTime.UtcNow
		};

	private static ForumCategory CreateCategory(Guid id) =>
		new()
		{
			Id = id,
			NameJson = "{\"en\":\"General\",\"zh\":\"综合\"}",
			IsEnabled = true,
			CreatedUtc = DateTime.UtcNow,
			UpdatedUtc = DateTime.UtcNow
		};
}
