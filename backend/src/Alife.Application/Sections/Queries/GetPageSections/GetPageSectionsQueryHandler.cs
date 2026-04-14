using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Queries.GetPageSections;

public sealed class GetPageSectionsQueryHandler(
	IAlifeDbContext dbContext,
	IGroupAuthorizationService groupAuthorizationService)
	: IRequestHandler<GetPageSectionsQuery, AppResult<IReadOnlyList<SectionDto>>>
{
	public async Task<AppResult<IReadOnlyList<SectionDto>>> Handle(GetPageSectionsQuery request, CancellationToken cancellationToken)
	{
		var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
		if (page is null)
		{
			return AppResult<IReadOnlyList<SectionDto>>.NotFound("Page was not found.");
		}

		var canView = await CanViewPageAsync(page, request.CurrentMemberId, cancellationToken);
		if (!canView)
		{
			return AppResult<IReadOnlyList<SectionDto>>.Forbidden("You do not have access to this page.");
		}

		var sections = await dbContext.Sections
			.Where(x => x.PageId == request.PageId)
			.OrderBy(x => x.Order)
			.Select(x => new SectionDto(x.Id, x.PageId, x.Order, x.Type, x.ContentJson, x.StyleJson))
			.ToListAsync(cancellationToken);

		return AppResult<IReadOnlyList<SectionDto>>.Success(sections);
	}

	private async Task<bool> CanViewPageAsync(Domain.Entities.Page page, Guid currentMemberId, CancellationToken cancellationToken)
	{
		if (page.Scope == PageScope.Global)
		{
			return true;
		}

		if (page.OwnerGroupId is null)
		{
			return false;
		}

		var isApproved = await groupAuthorizationService.IsApprovedMemberAsync(page.OwnerGroupId.Value, currentMemberId, cancellationToken);
		var isPrivileged = page.CreatedByMemberId == currentMemberId ||
			await groupAuthorizationService.IsLeaderOrCoLeaderAsync(page.OwnerGroupId.Value, currentMemberId, cancellationToken);

		return (isApproved && page.Visibility != PageVisibility.InvisibleDraft) || isPrivileged;
	}
}

