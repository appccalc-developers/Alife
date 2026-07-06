using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Forum.Queries.ListForumPosts;

public sealed record ListForumPostsQuery(
	Guid? CurrentMemberId,
	Guid? CategoryId,
	Guid? GroupId,
	ForumPostVisibility? Visibility,
	int Page = 1,
	int PageSize = 20)
	: IRequest<AppResult<PagedResult<ForumPostSummaryDto>>>;
