using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPublishedPageById;

public sealed record GetPublishedPageByIdQuery(Guid PageId) : IRequest<AppResult<PageDetailDto>>;
