namespace Alife.Application.Members.Dtos;

public sealed record MemberMembershipDto(
    Guid GroupId,
    string Status,
    string Role,
    IReadOnlyDictionary<string, string>? GroupName = null,
    Guid? ParentGroupId = null);
