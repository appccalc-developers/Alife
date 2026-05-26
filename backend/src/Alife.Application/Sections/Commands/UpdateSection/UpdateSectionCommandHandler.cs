using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Services;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Commands.UpdateSection;

public sealed class UpdateSectionCommandHandler(
	IAlifeDbContext dbContext,
	IGroupAuthorizationService groupAuthorizationService,
	IPageCacheInvalidationService pageCacheInvalidationService)
	: IRequestHandler<UpdateSectionCommand, AppResult<SectionDto>>
{
	public async Task<AppResult<SectionDto>> Handle(UpdateSectionCommand request, CancellationToken cancellationToken)
	{
		var section = await dbContext.Sections
			.Include(x => x.Page)
			.FirstOrDefaultAsync(x => x.Id == request.SectionId, cancellationToken);

		if (section is null)
		{
			return AppResult<SectionDto>.NotFound("Section was not found.");
		}

		var canEdit = await CanEditPageAsync(section.Page, request.CurrentMemberId, cancellationToken);
		if (!canEdit)
		{
			return AppResult<SectionDto>.Forbidden("You do not have permission to edit this section.");
		}

		section.Type = request.Type;
		section.Order = request.Order;
		section.ContentJson = string.IsNullOrWhiteSpace(request.ContentJson) ? "{}" : request.ContentJson;
		section.StyleJson = string.IsNullOrWhiteSpace(request.StyleJson) ? "{}" : request.StyleJson;
		section.Page.UpdatedUtc = DateTime.UtcNow;

		await dbContext.SaveChangesAsync(cancellationToken);
		await InvalidatePageAsync(section.Page, cancellationToken);

		return AppResult<SectionDto>.Success(ToDto(section));
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

		if (page.CreatedByMemberId == currentMemberId && page.Visibility == PageVisibility.Draft)
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

	private static SectionDto ToDto(Section section)
		=> new(section.Id, section.PageId, section.Order, section.Type, section.ContentJson, section.StyleJson);
}

