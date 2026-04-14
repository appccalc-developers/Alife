using Alife.Application.Common.Models;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Sections.Commands.UpdateSection;

public sealed record UpdateSectionCommand(
	Guid SectionId,
	Guid CurrentMemberId,
	SectionType Type,
	string? ContentJson,
	string? StyleJson,
	int Order) : IRequest<AppResult<SectionDto>>;

