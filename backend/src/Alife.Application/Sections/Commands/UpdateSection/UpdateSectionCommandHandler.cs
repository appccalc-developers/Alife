using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Commands.UpdateSection;

public sealed class UpdateSectionCommandHandler(
	IAlifeDbContext dbContext,
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

		if (section.Page.CreatedByMemberId != request.CurrentMemberId)
		{
			return AppResult<SectionDto>.Forbidden("Only the page owner can edit sections.");
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

	private static SectionDto ToDto(Section section)
		=> new(section.Id, section.PageId, section.Order, section.Type, section.ContentJson, section.StyleJson);
}

