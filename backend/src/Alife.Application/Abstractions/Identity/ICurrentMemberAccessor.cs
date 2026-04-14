namespace Alife.Application.Abstractions.Identity;

public interface ICurrentMemberAccessor
{
	Guid? GetCurrentMemberId();
}