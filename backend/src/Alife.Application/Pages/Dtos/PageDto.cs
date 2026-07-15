using Alife.Domain.Enums;

namespace Alife.Application.Pages.Dtos;

public sealed record PageDto(
    Guid Id,
    Guid OwnerGroupId,
    Guid CreatedByMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string TagsJson,
    string TitleDisplayStyle,
    PageVisibility Visibility,
    DateTime UpdatedUtc,
    IReadOnlyDictionary<string, string>? AccessName = null,
    PageReviewRefusalDto? ReviewRefusal = null,
    string? CardImageUrl = null,
    IReadOnlyDictionary<string, string>? CardText = null,
    IReadOnlyDictionary<string, string>? PrimaryMenuName = null,
    Guid? PrimaryMenuId = null,
    int PrimaryMenuSortOrder = 0,
    int MenuSortOrder = 0);

public sealed record PageReviewRefusalDto(
    Guid ReviewerMemberId,
    string? ReviewerDisplayName,
    DateTime RefusedUtc,
    string Reason);

public sealed record PageSectionDto(
    Guid? Id,
    int Order,
    Domain.Enums.SectionType Type,
    string ContentJson,
    string StyleJson);

public sealed record PageDetailDto(
    Guid Id,
    Guid OwnerGroupId,
    Guid CreatedByMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string TagsJson,
    string TitleDisplayStyle,
    PageVisibility Visibility,
    DateTime UpdatedUtc,
    IReadOnlyList<PageSectionDto> Sections);
