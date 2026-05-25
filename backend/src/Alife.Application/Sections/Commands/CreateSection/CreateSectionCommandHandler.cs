using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Services;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Commands.CreateSection;

public sealed class CreateSectionCommandHandler(
	IAlifeDbContext dbContext,
	IGroupAuthorizationService groupAuthorizationService,
	IPageCacheInvalidationService pageCacheInvalidationService)
	: IRequestHandler<CreateSectionCommand, AppResult<SectionDto>>
{
	public async Task<AppResult<SectionDto>> Handle(CreateSectionCommand request, CancellationToken cancellationToken)
	{
		var page = await dbContext.Pages
			.Include(x => x.Sections)
			.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);

		if (page is null)
		{
			return AppResult<SectionDto>.NotFound("Page was not found.");
		}

		var canEdit = await CanEditPageAsync(page, request.CurrentMemberId, cancellationToken);
		if (!canEdit)
		{
			return AppResult<SectionDto>.Forbidden("You do not have permission to add sections to this page.");
		}

		var order = request.Order ?? (page.Sections.Count == 0 ? 1 : page.Sections.Max(x => x.Order) + 1);
		var section = new Section
		{
			Id = Guid.NewGuid(),
			PageId = page.Id,
			Order = order,
			Type = request.Type,
			ContentJson = string.IsNullOrWhiteSpace(request.ContentJson) ? "{}" : request.ContentJson,
			StyleJson = string.IsNullOrWhiteSpace(request.StyleJson) ? "{}" : request.StyleJson
		};

		dbContext.Sections.Add(section);
		page.UpdatedUtc = DateTime.UtcNow;
		await dbContext.SaveChangesAsync(cancellationToken);
		await InvalidatePageAsync(page, cancellationToken);

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

		if (page.CreatedByMemberId == currentMemberId && page.Visibility == PageVisibility.InvisibleDraft)
		{
			return true;
		}

		return await groupAuthorizationService.IsLeaderOrCoLeaderAsync(page.OwnerGroupId.Value, currentMemberId, cancellationToken);
	}

	private async Task InvalidatePageAsync(Domain.Entities.Page page, CancellationToken cancellationToken)
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

