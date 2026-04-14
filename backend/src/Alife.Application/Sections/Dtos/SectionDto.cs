using Alife.Domain.Enums;

namespace Alife.Application.Sections.Dtos;

public sealed record SectionDto(
	Guid Id,
	Guid PageId,
	int Order,
	SectionType Type,
	string ContentJson,
	string StyleJson);

