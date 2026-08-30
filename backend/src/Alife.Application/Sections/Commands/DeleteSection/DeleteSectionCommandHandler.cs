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
				.ThenInclude(x => x.Sections)
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
		var now = DateTime.UtcNow;
		section.Page.UpdatedUtc = now;
		await PagePublicationReviewState.SubmitCopyIfPublicAsync(
			dbContext,
			section.Page,
			request.CurrentMemberId,
			now,
			cancellationToken);
		try
		{
			await dbContext.SaveChangesAsync(cancellationToken);
		}
		catch (DbUpdateConcurrencyException)
		{
			return AppResult<bool>.Conflict(PagePublicationReviewState.ConcurrentChangeMessage);
		}
		await InvalidatePageAsync(section.Page, cancellationToken);

		return AppResult<bool>.Success(true);
	}

	private async Task<bool> CanEditPageAsync(Page page, Guid currentMemberId, CancellationToken cancellationToken)
	{
		if (page.CreatedByMemberId == currentMemberId && page.Visibility == PageVisibility.Draft)
		{
			return true;
		}

		return await groupAuthorizationService.IsLeaderOrCoLeaderAsync(page.OwnerGroupId, currentMemberId, cancellationToken);
	}

	private async Task InvalidatePageAsync(Page page, CancellationToken cancellationToken)
	{
		await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);
		await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId, cancellationToken);
	}
}

