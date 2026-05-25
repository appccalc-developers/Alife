using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using MediatR;

namespace Alife.Application.Pages.Queries.GetGlobalPages;

public sealed class GetGlobalPagesQueryHandler(IPageReadService pageReadService)
    : IRequestHandler<GetGlobalPagesQuery, AppResult<IReadOnlyList<PageDto>>>
{
    public async Task<AppResult<IReadOnlyList<PageDto>>> Handle(GetGlobalPagesQuery request, CancellationToken cancellationToken)
    {
        var pages = await pageReadService.GetGlobalPagesAsync(cancellationToken);
        return AppResult<IReadOnlyList<PageDto>>.Success(pages);
    }
}
