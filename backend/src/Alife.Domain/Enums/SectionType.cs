namespace Alife.Domain.Enums;

public enum SectionType
{
	Hero = 0,
	RichText = 1,
	PostFeed = 2,
	Sermon = 3,
	CollectionShowcase = 4,
	[Obsolete("Use CollectionShowcase. Retained for backwards-compatible API deserialization.")]
	ListView = CollectionShowcase,
	LandingHero = 20,
	Countdown = 21,
	ContactLocation = 22,
	Spotlight = 23,
	Album = 24
}
