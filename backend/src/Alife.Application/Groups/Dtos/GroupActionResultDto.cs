namespace Alife.Application.Groups.Dtos;

public sealed record GroupActionResultDto(
    bool Ok,
    Guid? GroupId = null,
    Guid? ParentGroupId = null,
    Guid? MemberId = null);
