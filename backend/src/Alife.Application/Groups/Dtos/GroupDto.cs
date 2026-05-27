using Alife.Domain.Enums;

namespace Alife.Application.Groups.Dtos;

public sealed record GroupDto(
    Guid Id,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string>? Description,
    Guid? ParentGroupId,
    AccessType AccessType,
    bool IsChurch,
    bool IsClosed,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
