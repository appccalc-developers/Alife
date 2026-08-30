using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPublishedPageById;

public sealed class GetPublishedPageByIdQueryHandler(IPageReadService pageReadService)
    : IRequestHandler<GetPublishedPageByIdQuery, AppResult<PageDetailDto>>
{
    public async Task<AppResult<PageDetailDto>> Handle(
        GetPublishedPageByIdQuery request,
        CancellationToken cancellationToken)
    {
        var page = await pageReadService.GetPublishedByIdAsync(request.PageId, cancellationToken);
        return page is null
            ? AppResult<PageDetailDto>.NotFound("Published page was not found.")
            : AppResult<PageDetailDto>.Success(page);
    }
}
