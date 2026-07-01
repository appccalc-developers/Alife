using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.IgnorePageGlobalReview;

public sealed class IgnorePageGlobalReviewCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<IgnorePageGlobalReviewCommand, AppResult<PageGlobalReviewActionDto>>
{
    public async Task<AppResult<PageGlobalReviewActionDto>> Handle(
        IgnorePageGlobalReviewCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<PageGlobalReviewActionDto>.Forbidden("Page reviewer access is required.");
        }

        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageGlobalReviewActionDto>.NotFound("Page was not found.");
        }

        if (page.Scope != PageScope.Group || page.OwnerGroupId is null || page.Visibility != PageVisibility.Public)
        {
            return AppResult<PageGlobalReviewActionDto>.Conflict("Only public group pages can be ignored from global review.");
        }

        var now = DateTime.UtcNow;
        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PageGlobalReviewActions.Ignore,
            EntityType = "page",
            EntityId = page.Id,
            GroupId = page.OwnerGroupId,
            MetadataJson = JsonSerializer.Serialize(new { pageUpdatedUtc = page.UpdatedUtc }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        return AppResult<PageGlobalReviewActionDto>.Success(new PageGlobalReviewActionDto(
            true,
            page.Id,
            page.OwnerGroupId,
            null));
    }
}
