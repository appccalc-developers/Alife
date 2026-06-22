namespace Alife.Application.Admin.Dtos;

public sealed record AdminGroupOptionDto(
    Guid Id,
    string NameJson,
    bool IsChurch,
    bool IsClosed,
    Guid? ParentGroupId);
