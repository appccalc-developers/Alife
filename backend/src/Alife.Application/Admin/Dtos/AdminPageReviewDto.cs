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
    Guid? OwnerGroupId,
    IReadOnlyDictionary<string, string> OwnerGroupName,
    Guid CreatedByMemberId,
    string? CreatorDisplayName,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string TagsJson,
    string TitleDisplayStyle,
    PageVisibility Visibility,
    AdminPageReviewStatus ReviewStatus,
    IReadOnlyDictionary<string, string>? AccessName,
    string? ReturnReason,
    DateTime? ReviewedUtc,
    DateTime UpdatedUtc);

public sealed record PageGlobalReviewActionDto(
    bool Ok,
    Guid PageId,
    Guid? PreviousOwnerGroupId,
    PageDto? Page);
