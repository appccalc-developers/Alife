using Alife.Application.Common.Models;
using Alife.Application.Sections.Dtos;
using MediatR;

namespace Alife.Application.Sections.Queries.GetPageSections;

public sealed record GetPageSectionsQuery(Guid PageId, Guid CurrentMemberId) : IRequest<AppResult<IReadOnlyList<SectionDto>>>;

