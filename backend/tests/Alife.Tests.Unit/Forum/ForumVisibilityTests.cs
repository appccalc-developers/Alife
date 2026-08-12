using Alife.Application.Common.Models;
using Alife.Application.Forum.Commands.CreateForumComment;
using Alife.Application.Forum.Commands.UpdateForumComment;
using Alife.Application.Forum.Queries.GetForumPost;
using Alife.Application.Forum.Queries.ListForumPosts;
using Alife.Application.Forum.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Forum;

public class ForumVisibilityTests
{
	[Fact]
	public async Task ListGroupPosts_AnonymousViewerReceivesOnlyPublicPostsAndPublicCommentMetadata()
	{
		using var dbContext = CreateDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var groupId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var authorId = Guid.NewGuid();
		var publicPost = CreatePost(categoryId, groupId, authorId, ForumPostVisibility.Public);
		var groupPost = CreatePost(categoryId, groupId, authorId, ForumPostVisibility.GroupOnly);
		var publicCommentUtc = DateTime.UtcNow.AddMinutes(-10);
		var groupCommentUtc = DateTime.UtcNow.AddMinutes(-1);
		dbContext.Members.Add(CreateMember(authorId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.AddRange(publicPost, groupPost);
		dbContext.ForumComments.AddRange(
			CreateComment(publicPost.Id, authorId, ForumCommentVisibility.Public, publicCommentUtc),
			CreateComment(publicPost.Id, authorId, ForumCommentVisibility.GroupOnly, groupCommentUtc));
		await dbContext.SaveChangesAsync();

		var handler = new ListForumPostsQueryHandler(dbContext, authorization);
		var result = await handler.Handle(
			new ListForumPostsQuery(null, null, groupId, null, 1, 20),
			CancellationToken.None);

		Assert.True(result.IsSuccess);
		var post = Assert.Single(result.Value!.Items);
		Assert.Equal(publicPost.Id, post.Id);
		Assert.Equal(1, post.CommentCount);
		Assert.Equal(publicCommentUtc, post.LastCommentUtc);
		Assert.Equal(publicCommentUtc, post.UpdatedUtc);
	}

	[Fact]
	public async Task ListGroupPosts_ApprovedMemberReceivesPublicAndGroupOnlyContent()
	{
		using var dbContext = CreateDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var groupId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var publicPost = CreatePost(categoryId, groupId, memberId, ForumPostVisibility.Public);
		var groupPost = CreatePost(categoryId, groupId, memberId, ForumPostVisibility.GroupOnly);
		dbContext.Members.Add(CreateMember(memberId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.AddRange(publicPost, groupPost);
		dbContext.ForumComments.AddRange(
			CreateComment(publicPost.Id, memberId, ForumCommentVisibility.Public, DateTime.UtcNow.AddMinutes(-2)),
			CreateComment(publicPost.Id, memberId, ForumCommentVisibility.GroupOnly, DateTime.UtcNow.AddMinutes(-1)),
			CreateComment(groupPost.Id, memberId, ForumCommentVisibility.GroupOnly, DateTime.UtcNow));
		await dbContext.SaveChangesAsync();
		authorization.CanWriteGroupForumAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);

		var handler = new ListForumPostsQueryHandler(dbContext, authorization);
		var result = await handler.Handle(
			new ListForumPostsQuery(memberId, null, groupId, null, 1, 20),
			CancellationToken.None);

		Assert.True(result.IsSuccess);
		Assert.Equal(2, result.Value!.Items.Count);
		Assert.Equal(2, result.Value.Items.Single(x => x.Id == publicPost.Id).CommentCount);
		Assert.Equal(1, result.Value.Items.Single(x => x.Id == groupPost.Id).CommentCount);
	}

	[Fact]
	public async Task GetPublicGroupPost_NonMemberReceivesOnlyPublicComments()
	{
		using var dbContext = CreateDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var groupId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var authorId = Guid.NewGuid();
		var post = CreatePost(categoryId, groupId, authorId, ForumPostVisibility.Public);
		var publicComment = CreateComment(post.Id, authorId, ForumCommentVisibility.Public, DateTime.UtcNow.AddMinutes(-5));
		var groupComment = CreateComment(post.Id, authorId, ForumCommentVisibility.GroupOnly, DateTime.UtcNow);
		dbContext.Members.Add(CreateMember(authorId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.Add(post);
		dbContext.ForumComments.AddRange(publicComment, groupComment);
		await dbContext.SaveChangesAsync();
		authorization.CanReadPostAsync(Arg.Any<ForumPost>(), null, Arg.Any<CancellationToken>()).Returns(true);

		var handler = new GetForumPostQueryHandler(dbContext, authorization);
		var result = await handler.Handle(new GetForumPostQuery(post.Id, null), CancellationToken.None);

		Assert.True(result.IsSuccess);
		var comment = Assert.Single(result.Value!.Comments);
		Assert.Equal(publicComment.Id, comment.Id);
		Assert.Equal(ForumCommentVisibility.Public, comment.Visibility);
		Assert.Equal(1, result.Value.CommentCount);
		Assert.Equal(publicComment.CreatedUtc, result.Value.LastCommentUtc);
	}

	[Fact]
	public async Task CreateComment_PublicGroupPostDefaultsToGroupOnlyForApprovedMember()
	{
		using var dbContext = CreateDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var groupId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var post = CreatePost(categoryId, groupId, memberId, ForumPostVisibility.Public);
		dbContext.Members.Add(CreateMember(memberId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.Add(post);
		await dbContext.SaveChangesAsync();
		authorization.CanReadPostAsync(post, memberId, Arg.Any<CancellationToken>()).Returns(true);
		authorization.CanWriteSiteForumAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
		authorization.CanWriteGroupForumAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);

		var handler = new CreateForumCommentCommandHandler(dbContext, authorization);
		var result = await handler.Handle(
			new CreateForumCommentCommand(
				post.Id,
				memberId,
				null,
				new Dictionary<string, string> { ["en"] = "Group response" },
				null),
			CancellationToken.None);

		Assert.True(result.IsSuccess);
		Assert.Equal(ForumCommentVisibility.GroupOnly, result.Value!.Visibility);
		Assert.Equal(ForumCommentVisibility.GroupOnly, (await dbContext.ForumComments.SingleAsync()).Visibility);
	}

	[Fact]
	public async Task CreateComment_PublicReplyToGroupOnlyCommentReturnsValidation()
	{
		using var dbContext = CreateDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var groupId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var post = CreatePost(categoryId, groupId, memberId, ForumPostVisibility.Public);
		var parent = CreateComment(post.Id, memberId, ForumCommentVisibility.GroupOnly, DateTime.UtcNow);
		dbContext.Members.Add(CreateMember(memberId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.Add(post);
		dbContext.ForumComments.Add(parent);
		await dbContext.SaveChangesAsync();
		authorization.CanReadPostAsync(post, memberId, Arg.Any<CancellationToken>()).Returns(true);
		authorization.CanWriteSiteForumAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
		authorization.CanWriteGroupForumAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);

		var handler = new CreateForumCommentCommandHandler(dbContext, authorization);
		var result = await handler.Handle(
			new CreateForumCommentCommand(
				post.Id,
				memberId,
				parent.Id,
				new Dictionary<string, string> { ["en"] = "Public reply" },
				null,
				ForumCommentVisibility.Public),
			CancellationToken.None);

		Assert.Equal(AppResultStatus.ValidationError, result.Status);
		Assert.Equal(1, await dbContext.ForumComments.CountAsync());
	}

	[Fact]
	public async Task CreateComment_PublicRequestOnGroupOnlyPostIsForcedToGroupOnly()
	{
		using var dbContext = CreateDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var groupId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var post = CreatePost(categoryId, groupId, memberId, ForumPostVisibility.GroupOnly);
		dbContext.Members.Add(CreateMember(memberId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.Add(post);
		await dbContext.SaveChangesAsync();
		authorization.CanReadPostAsync(post, memberId, Arg.Any<CancellationToken>()).Returns(true);
		authorization.CanWriteSiteForumAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
		authorization.CanWriteGroupForumAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);

		var handler = new CreateForumCommentCommandHandler(dbContext, authorization);
		var result = await handler.Handle(
			new CreateForumCommentCommand(
				post.Id,
				memberId,
				null,
				new Dictionary<string, string> { ["en"] = "Private response" },
				null,
				ForumCommentVisibility.Public),
			CancellationToken.None);

		Assert.True(result.IsSuccess);
		Assert.Equal(ForumCommentVisibility.GroupOnly, result.Value!.Visibility);
	}

	[Fact]
	public async Task CreateComment_NonMemberCannotCommentOnPublicGroupPost()
	{
		using var dbContext = CreateDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var groupId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var authorId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var post = CreatePost(categoryId, groupId, authorId, ForumPostVisibility.Public);
		dbContext.Members.AddRange(CreateMember(authorId), CreateMember(memberId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.Add(post);
		await dbContext.SaveChangesAsync();
		authorization.CanReadPostAsync(post, memberId, Arg.Any<CancellationToken>()).Returns(true);
		authorization.CanWriteSiteForumAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
		authorization.CanWriteGroupForumAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(false);

		var handler = new CreateForumCommentCommandHandler(dbContext, authorization);
		var result = await handler.Handle(
			new CreateForumCommentCommand(
				post.Id,
				memberId,
				null,
				new Dictionary<string, string> { ["en"] = "Not allowed" },
				null,
				ForumCommentVisibility.Public),
			CancellationToken.None);

		Assert.Equal(AppResultStatus.Forbidden, result.Status);
		Assert.Empty(dbContext.ForumComments);
	}

	[Fact]
	public async Task UpdateComment_ToGroupOnlyAlsoRestrictsAllDescendants()
	{
		using var dbContext = CreateDbContext();
		var authorization = Substitute.For<IForumAuthorizationService>();
		var groupId = Guid.NewGuid();
		var categoryId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var post = CreatePost(categoryId, groupId, memberId, ForumPostVisibility.Public);
		var root = CreateComment(post.Id, memberId, ForumCommentVisibility.Public, DateTime.UtcNow.AddMinutes(-3));
		var child = CreateComment(post.Id, memberId, ForumCommentVisibility.Public, DateTime.UtcNow.AddMinutes(-2));
		child.ParentCommentId = root.Id;
		var grandchild = CreateComment(post.Id, memberId, ForumCommentVisibility.Public, DateTime.UtcNow.AddMinutes(-1));
		grandchild.ParentCommentId = child.Id;
		dbContext.Members.Add(CreateMember(memberId));
		dbContext.ForumCategories.Add(CreateCategory(categoryId));
		dbContext.ForumPosts.Add(post);
		dbContext.ForumComments.AddRange(root, child, grandchild);
		await dbContext.SaveChangesAsync();
		authorization.CanModerateGroupForumAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(false);
		authorization.CanWriteGroupForumAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);

		var handler = new UpdateForumCommentCommandHandler(dbContext, authorization);
		var result = await handler.Handle(
			new UpdateForumCommentCommand(
				post.Id,
				root.Id,
				memberId,
				new Dictionary<string, string> { ["en"] = "Restricted thread" },
				null,
				ForumCommentVisibility.GroupOnly),
			CancellationToken.None);

		Assert.True(result.IsSuccess);
		Assert.All(
			await dbContext.ForumComments.OrderBy(x => x.CreatedUtc).ToListAsync(),
			comment => Assert.Equal(ForumCommentVisibility.GroupOnly, comment.Visibility));
	}

	private static AlifeDbContext CreateDbContext()
	{
		var options = new DbContextOptionsBuilder<AlifeDbContext>()
			.UseInMemoryDatabase(Guid.NewGuid().ToString())
			.Options;
		return new AlifeDbContext(options);
	}

	private static ForumPost CreatePost(Guid categoryId, Guid groupId, Guid authorId, ForumPostVisibility visibility)
	{
		var createdUtc = DateTime.UtcNow.AddHours(-1);
		return new ForumPost
		{
			Id = Guid.NewGuid(),
			CategoryId = categoryId,
			GroupId = groupId,
			AuthorMemberId = authorId,
			TitleJson = "{\"en\":\"Title\"}",
			BodyJson = "{\"en\":\"Body\"}",
			MediaJson = "[]",
			Visibility = visibility,
			CreatedUtc = createdUtc,
			UpdatedUtc = createdUtc
		};
	}

	private static ForumComment CreateComment(
		Guid postId,
		Guid authorId,
		ForumCommentVisibility visibility,
		DateTime createdUtc) =>
		new()
		{
			Id = Guid.NewGuid(),
			PostId = postId,
			AuthorMemberId = authorId,
			BodyJson = "{\"en\":\"Comment\"}",
			MediaJson = "[]",
			Visibility = visibility,
			CreatedUtc = createdUtc,
			UpdatedUtc = createdUtc
		};

	private static Member CreateMember(Guid id) => new()
	{
		Id = id,
		DisplayName = "Forum member",
		IsRegistered = true,
		CreatedUtc = DateTime.UtcNow,
		UpdatedUtc = DateTime.UtcNow
	};

	private static ForumCategory CreateCategory(Guid id) => new()
	{
		Id = id,
		NameJson = "{\"en\":\"General\"}",
		IsEnabled = true,
		CreatedUtc = DateTime.UtcNow,
		UpdatedUtc = DateTime.UtcNow
	};
}
