using Alife.Domain.Enums;

namespace Alife.Application.Groups.Dtos;

public sealed record GroupSummaryDto(
    Guid Id,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string>? Description,
    Guid? ParentGroupId,
    AccessType AccessType,
    bool IsChurch,
    bool IsClosed);
