using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Commands.DeleteSection;

public sealed class DeleteSectionCommandHandler(
	IAlifeDbContext dbContext,
	IGroupAuthorizationService groupAuthorizationService,
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

		var canEdit = await CanEditPageAsync(section.Page, request.CurrentMemberId, cancellationToken);
		if (!canEdit)
		{
			return AppResult<bool>.Forbidden("You do not have permission to delete this section.");
		}

		section.IsDeleted = true;
		section.Page.UpdatedUtc = DateTime.UtcNow;
		await dbContext.SaveChangesAsync(cancellationToken);
		await InvalidatePageAsync(section.Page, cancellationToken);

		return AppResult<bool>.Success(true);
	}

	private async Task<bool> CanEditPageAsync(Page page, Guid currentMemberId, CancellationToken cancellationToken)
	{
		if (page.Scope == PageScope.Global)
		{
			return await groupAuthorizationService.IsAdminAsync(currentMemberId, cancellationToken);
		}

		if (page.OwnerGroupId is null)
		{
			return false;
		}

		if (page.CreatedByMemberId == currentMemberId && page.Visibility == PageVisibility.InvisibleDraft)
		{
			return true;
		}

		return await groupAuthorizationService.IsLeaderOrCoLeaderAsync(page.OwnerGroupId.Value, currentMemberId, cancellationToken);
	}

	private async Task InvalidatePageAsync(Page page, CancellationToken cancellationToken)
	{
		await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);
		if (page.Scope == Domain.Enums.PageScope.Global)
		{
			await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);
			return;
		}

		if (page.OwnerGroupId.HasValue)
		{
			await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId.Value, cancellationToken);
		}
	}
}

