using Alife.Domain.Enums;

namespace Alife.Application.Groups.Dtos;

public sealed record GroupDto(
    Guid Id,
    string Name,
    Guid? ParentGroupId,
    AccessType AccessType,
    bool IsChurch,
    bool IsClosed,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
