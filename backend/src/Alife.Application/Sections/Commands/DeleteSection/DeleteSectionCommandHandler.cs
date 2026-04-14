using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Commands.DeleteSection;

public sealed class DeleteSectionCommandHandler(
	IAlifeDbContext dbContext,
	IPageCacheInvalidationService pageCacheInvalidationService)
	: IRequestHandler<DeleteSectionCommand, AppResult<bool>>
{
	public async Task<AppResult<bool>> Handle(DeleteSectionCommand request, CancellationToken cancellationToken)
	{
		var section = await dbContext.Sections
			.Include(x => x.Page)
			.FirstOrDefaultAsync(x => x.Id == request.SectionId, cancellationToken);

		if (section is null)
		{
			return AppResult<bool>.NotFound("Section was not found.");
		}

		if (section.Page.CreatedByMemberId != request.CurrentMemberId)
		{
			return AppResult<bool>.Forbidden("Only the page owner can delete sections.");
		}

		dbContext.Sections.Remove(section);
		section.Page.UpdatedUtc = DateTime.UtcNow;
		await dbContext.SaveChangesAsync(cancellationToken);
		await InvalidatePageAsync(section.Page, cancellationToken);

		return AppResult<bool>.Success(true);
	}

	private async Task InvalidatePageAsync(Page page, CancellationToken cancellationToken)
	{
		await pageCacheInvalidationService.RemoveBySlugAsync(page.Slug, page.Language, cancellationToken);
		if (page.Scope == Domain.Enums.PageScope.Global)
		{
			await pageCacheInvalidationService.RemoveGlobalAsync(page.Language, cancellationToken);
			return;
		}

		if (page.OwnerGroupId.HasValue)
		{
			await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId.Value, page.Language, cancellationToken);
		}
	}
}

