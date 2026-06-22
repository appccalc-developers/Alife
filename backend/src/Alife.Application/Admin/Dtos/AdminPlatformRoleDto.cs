namespace Alife.Application.Admin.Dtos;

public sealed record AdminPlatformRoleDto(int Id, string Code, IReadOnlyDictionary<string, string> Name, int Level);
