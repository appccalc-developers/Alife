namespace Alife.Domain.Entities;

public class PlatformRole
{
	public int Id { get; set; }
	public string Code { get; set; } = string.Empty;
	public string NameJson { get; set; } = "{}";
	public string PermissionsJson { get; set; } = "[]";
	public int Level { get; set; }

	public ICollection<MemberPlatformRole> MemberRoles { get; set; } = [];
}
