using Alife.Application.Pages.Dtos;
using Alife.Domain.Enums;

namespace Alife.Application.Admin.Dtos;

public sealed record AdminPageReviewDto(
    Guid Id,
    PageScope Scope,
    Guid? OwnerGroupId,
    IReadOnlyDictionary<string, string> OwnerGroupName,
    Guid CreatedByMemberId,
    string? CreatorDisplayName,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string TagsJson,
    string TitleDisplayStyle,
    PageVisibility Visibility,
    DateTime UpdatedUtc);

public sealed record PageGlobalReviewActionDto(
    bool Ok,
    Guid PageId,
    Guid? PreviousOwnerGroupId,
    PageDto? Page);
