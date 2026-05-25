using Alife.Domain.Enums;

namespace Alife.Application.Pages.Dtos;

public sealed record PageDto(
    Guid Id,
    PageScope Scope,
    Guid? OwnerGroupId,
    Guid CreatedByMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string TagsJson,
    string TitleDisplayStyle,
    PageVisibility Visibility,
    DateTime UpdatedUtc);

public sealed record PageSectionDto(
    Guid? Id,
    int Order,
    Domain.Enums.SectionType Type,
    string ContentJson,
    string StyleJson);

public sealed record PageDetailDto(
    Guid Id,
    PageScope Scope,
    Guid? OwnerGroupId,
    Guid CreatedByMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string TagsJson,
    string TitleDisplayStyle,
    PageVisibility Visibility,
    DateTime UpdatedUtc,
    IReadOnlyList<PageSectionDto> Sections);
