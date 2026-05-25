using Alife.Application.Common.Models;
using Alife.Application.Sermons.Dtos;
using Alife.Application.Sermons.Services;
using MediatR;

namespace Alife.Application.Sermons.Queries.GetSermons;

public sealed class GetSermonsQueryHandler(ISermonReadService sermonReadService)
    : IRequestHandler<GetSermonsQuery, AppResult<IReadOnlyList<SermonDto>>>
{
    public async Task<AppResult<IReadOnlyList<SermonDto>>> Handle(GetSermonsQuery request, CancellationToken cancellationToken)
    {
        var sermons = await sermonReadService.GetSermonsAsync(cancellationToken);

        return AppResult<IReadOnlyList<SermonDto>>.Success(sermons);
    }
}
