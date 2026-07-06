using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using MediatR;

namespace Alife.Application.Forum.Queries.ListForumCategories;

public sealed record ListForumCategoriesQuery(bool IncludeDisabled = false)
	: IRequest<AppResult<IReadOnlyList<ForumCategoryDto>>>;
