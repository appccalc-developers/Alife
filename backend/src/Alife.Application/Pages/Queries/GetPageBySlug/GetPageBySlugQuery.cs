using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPageById;

public sealed record GetPageByIdQuery(Guid PageId, Guid CurrentMemberId)
    : IRequest<AppResult<PageDetailDto>>;
