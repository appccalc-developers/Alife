using Alife.Application.Common.Models;
using Alife.Application.Sermons.Dtos;
using Alife.Application.Sermons.Services;
using MediatR;

namespace Alife.Application.Sermons.Queries.GetSermons;

public sealed class GetSermonsQueryHandler(ISermonReadService sermonReadService)
    : IRequestHandler<GetSermonsQuery, AppResult<PagedResult<SermonDto>>>
{
    public async Task<AppResult<PagedResult<SermonDto>>> Handle(GetSermonsQuery request, CancellationToken cancellationToken)
    {
        var sermons = await sermonReadService.GetSermonsAsync(request.Page, request.PageSize, cancellationToken);

        return AppResult<PagedResult<SermonDto>>.Success(sermons);
    }
}
