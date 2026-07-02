using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPublicPages;

public sealed class GetPublicPagesQueryHandler(IPageReadService pageReadService)
    : IRequestHandler<GetPublicPagesQuery, AppResult<IReadOnlyList<PageDto>>>
{
    public async Task<AppResult<IReadOnlyList<PageDto>>> Handle(GetPublicPagesQuery request, CancellationToken cancellationToken)
    {
        var pages = await pageReadService.GetPublicPagesAsync(cancellationToken);
        return AppResult<IReadOnlyList<PageDto>>.Success(pages);
    }
}
