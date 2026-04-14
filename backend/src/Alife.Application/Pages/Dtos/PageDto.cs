using Alife.Domain.Enums;

namespace Alife.Application.Pages.Dtos;

public sealed record PageDto(
    Guid Id,
    PageScope Scope,
    Guid? OwnerGroupId,
    Guid CreatedByMemberId,
    string Title,
    string? Description,
    string TagsJson,
    string TitleDisplayStyle,
    string Slug,
    string Language,
    PageVisibility Visibility,
    DateTime UpdatedUtc);
