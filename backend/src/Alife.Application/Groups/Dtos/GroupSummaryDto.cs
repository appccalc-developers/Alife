using Alife.Domain.Enums;

namespace Alife.Application.Groups.Dtos;

public sealed record GroupSummaryDto(
    Guid Id,
    string Name,
    Guid? ParentGroupId,
    AccessType AccessType,
    bool IsChurch,
    bool IsClosed);
