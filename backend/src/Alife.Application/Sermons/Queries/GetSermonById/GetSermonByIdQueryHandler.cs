using Alife.Application.Common.Models;
using Alife.Application.Sermons.Dtos;
using Alife.Application.Sermons.Services;
using MediatR;

namespace Alife.Application.Sermons.Queries.GetSermonById;

public sealed class GetSermonByIdQueryHandler(ISermonReadService sermonReadService)
    : IRequestHandler<GetSermonByIdQuery, AppResult<SermonDto>>
{
    public async Task<AppResult<SermonDto>> Handle(GetSermonByIdQuery request, CancellationToken cancellationToken)
    {
        var sermon = await sermonReadService.GetSermonByIdAsync(request.SermonId, cancellationToken);
        return sermon is null
            ? AppResult<SermonDto>.NotFound("Sermon was not found.")
            : AppResult<SermonDto>.Success(sermon);
    }
}
