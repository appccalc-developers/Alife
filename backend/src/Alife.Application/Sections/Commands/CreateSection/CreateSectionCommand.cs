using Alife.Application.Common.Models;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Sections.Commands.CreateSection;

public sealed record CreateSectionCommand(
	Guid PageId,
	Guid CurrentMemberId,
	SectionType Type,
	string? ContentJson,
	string? StyleJson,
	int? Order) : IRequest<AppResult<SectionDto>>;

