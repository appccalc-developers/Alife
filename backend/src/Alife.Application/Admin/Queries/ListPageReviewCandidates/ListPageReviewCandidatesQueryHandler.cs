using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Queries.ListPageReviewCandidates;

public sealed class ListPageReviewCandidatesQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListPageReviewCandidatesQuery, AppResult<IReadOnlyList<AdminPageReviewDto>>>
{
    public async Task<AppResult<IReadOnlyList<AdminPageReviewDto>>> Handle(
        ListPageReviewCandidatesQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<IReadOnlyList<AdminPageReviewDto>>.Forbidden("Page reviewer access is required.");
        }

        var rows = await dbContext.Pages
            .AsNoTracking()
            .Where(page => page.Scope == PageScope.Global ||
                           (page.Scope == PageScope.Group && page.OwnerGroupId != null))
            .OrderByDescending(page => page.UpdatedUtc)
            .Select(page => new
            {
                page.Id,
                page.Scope,
                page.OwnerGroupId,
                OwnerGroupNameJson = page.OwnerGroup == null ? null : page.OwnerGroup.NameJson,
                page.CreatedByMemberId,
                CreatorDisplayName = page.CreatedByMember.DisplayName,
                page.TitleJson,
                page.DescriptionJson,
                page.TagsJson,
                page.TitleDisplayStyle,
                page.Visibility,
                page.UpdatedUtc
            })
            .ToListAsync(cancellationToken);

        var candidates = rows
            .Select(row => new AdminPageReviewDto(
                row.Id,
                row.Scope,
                row.OwnerGroupId,
                ReadTextMap(row.OwnerGroupNameJson),
                row.CreatedByMemberId,
                row.CreatorDisplayName,
                ReadTextMap(row.TitleJson),
                ReadNullableTextMap(row.DescriptionJson),
                row.TagsJson,
                row.TitleDisplayStyle,
                row.Visibility,
                row.UpdatedUtc))
            .ToList();

        return AppResult<IReadOnlyList<AdminPageReviewDto>>.Success(candidates);
    }

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => ReadNullableTextMap(value) ?? new Dictionary<string, string>();

    private static IReadOnlyDictionary<string, string>? ReadNullableTextMap(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(value);
        }
        catch
        {
            return new Dictionary<string, string> { ["en"] = value };
        }
    }
}
