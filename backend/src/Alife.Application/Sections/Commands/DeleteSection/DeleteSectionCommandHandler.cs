using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Commands.DeleteSection;

public sealed class DeleteSectionCommandHandler(
	IAlifeDbContext dbContext,
	IPageCacheInvalidationService pageCacheInvalidationService,
	ISyncNotificationService syncNotificationService)
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
		await syncNotificationService.PublishAsync(
			new SyncEntityChange(
				"page",
				section.Page.Id.ToString("N"),
				$"/api/pages/{Uri.EscapeDataString(section.Page.Slug)}?lang={Uri.EscapeDataString(section.Page.Language)}",
				GetVersionKeys(section.Page),
				await GetRecipientIdsAsync(section.Page, cancellationToken)),
			cancellationToken);

		return AppResult<bool>.Success(true);
	}

	private static IReadOnlyCollection<string> GetVersionKeys(Page page)
	{
		var keys = new List<string>
		{
			SyncKeys.Page(page.Id),
			SyncKeys.PageSlug(page.Slug, page.Language)
		};

		if (page.Scope == Domain.Enums.PageScope.Global)
		{
			keys.Add(SyncKeys.GlobalPages(page.Language));
		}
		else if (page.OwnerGroupId.HasValue)
		{
			keys.Add(SyncKeys.GroupPages(page.OwnerGroupId.Value, page.Language));
		}

		return keys;
	}

	private async Task<IReadOnlyCollection<Guid>> GetRecipientIdsAsync(Page page, CancellationToken cancellationToken)
	{
		if (page.Scope == Domain.Enums.PageScope.Global)
		{
			return await dbContext.Members
				.Where(x => x.IsRegistered)
				.Select(x => x.Id)
				.ToArrayAsync(cancellationToken);
		}

		if (page.OwnerGroupId is not Guid groupId)
		{
			return [page.CreatedByMemberId];
		}

		return await dbContext.GroupMemberships
			.Where(x => x.GroupId == groupId && x.Status == Domain.Enums.MembershipStatus.Approved)
			.Select(x => x.MemberId)
			.Distinct()
			.ToArrayAsync(cancellationToken);
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

