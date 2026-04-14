using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Commands.CreateSection;

public sealed class CreateSectionCommandHandler(
	IAlifeDbContext dbContext,
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

		if (page.CreatedByMemberId != request.CurrentMemberId)
		{
			return AppResult<SectionDto>.Forbidden("Only the page owner can add sections.");
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

	private async Task InvalidatePageAsync(Domain.Entities.Page page, CancellationToken cancellationToken)
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

