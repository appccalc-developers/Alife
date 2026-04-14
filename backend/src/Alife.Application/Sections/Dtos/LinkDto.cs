using Alife.Domain.Enums;

namespace Alife.Application.Sections.Dtos;

public sealed record LinkDto(
    Guid Id,
    Guid OwnerSectionId,
    LinkType Type,
    Guid? TargetGroupId,
    Guid? TargetPageId,
    string Title,
    string? ImageUrl,
    int SortOrder);
