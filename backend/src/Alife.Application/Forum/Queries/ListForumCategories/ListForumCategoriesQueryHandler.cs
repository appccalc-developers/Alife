using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Queries.ListForumCategories;

public sealed class ListForumCategoriesQueryHandler(IAlifeDbContext dbContext)
	: IRequestHandler<ListForumCategoriesQuery, AppResult<IReadOnlyList<ForumCategoryDto>>>
{
	public async Task<AppResult<IReadOnlyList<ForumCategoryDto>>> Handle(
		ListForumCategoriesQuery request,
		CancellationToken cancellationToken)
	{
		var query = dbContext.ForumCategories.AsNoTracking();
		if (!request.IncludeDisabled)
		{
			query = query.Where(x => x.IsEnabled);
		}

		var categories = await query
			.OrderBy(x => x.SortOrder)
			.ThenBy(x => x.Id)
			.Select(x => new ForumCategoryDto(
				x.Id,
				x.NameJson,
				x.DescriptionJson,
				x.SortOrder,
				x.IsEnabled))
			.ToListAsync(cancellationToken);

		return AppResult<IReadOnlyList<ForumCategoryDto>>.Success(categories);
	}
}
