using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Sections.Commands.DeleteSection;

public sealed record DeleteSectionCommand(Guid SectionId, Guid CurrentMemberId) : IRequest<AppResult<bool>>;

