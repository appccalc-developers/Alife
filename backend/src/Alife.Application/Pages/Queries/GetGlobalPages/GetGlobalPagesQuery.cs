using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Queries.GetGlobalPages;

public sealed record GetGlobalPagesQuery(string Language) : IRequest<AppResult<IReadOnlyList<PageDto>>>;
