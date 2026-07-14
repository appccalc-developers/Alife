namespace Alife.Domain.Entities;

public class EventContactProfile
{
	public Guid EventId { get; set; }
	public Guid ContactProfileId { get; set; }

	public GroupEvent Event { get; set; } = null!;
	public ContactProfile ContactProfile { get; set; } = null!;
}
