using Alife.Application.Pages.Dtos;
using Alife.Domain.Enums;

namespace Alife.Application.Admin.Dtos;

public enum AdminPageReviewStatus
{
    Pending = 0,
    Approved = 1,
    Returned = 2
}

public sealed record AdminPageReviewDto(
    Guid Id,
    Guid OwnerGroupId,
    IReadOnlyDictionary<string, string> OwnerGroupName,
    Guid CreatedByMemberId,
    string? CreatorDisplayName,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string TagsJson,
    string TitleDisplayStyle,
    PageVisibility Visibility,
    AdminPageReviewStatus ReviewStatus,
    Guid? PrimaryMenuId,
    IReadOnlyDictionary<string, string>? PrimaryMenuName,
    int MenuSortOrder,
    IReadOnlyDictionary<string, string>? AccessName,
    string? CardImageUrl,
    IReadOnlyDictionary<string, string>? CardText,
    string? ReturnReason,
    DateTime? ReviewedUtc,
    DateTime UpdatedUtc);

public sealed record AdminPagePrimaryMenuDto(
    Guid Id,
    IReadOnlyDictionary<string, string> Name,
    int SortOrder,
    int ApprovedPageCount,
    PagePrimaryMenuHomePlacement? HomePlacement = null);

public sealed record PagePrimaryMenuLayoutItemDto(
    Guid PrimaryMenuId,
    IReadOnlyList<Guid> PageIds);

public sealed record PagePublicationReviewActionDto(
    bool Ok,
    Guid PageId,
    Guid OwnerGroupId,
    PageDto? Page);
