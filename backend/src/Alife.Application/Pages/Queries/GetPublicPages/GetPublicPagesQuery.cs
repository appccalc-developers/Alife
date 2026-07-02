using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPublicPages;

public sealed record GetPublicPagesQuery : IRequest<AppResult<IReadOnlyList<PageDto>>>;
