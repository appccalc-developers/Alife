using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Sermons.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sermons.Queries.GetSermons;

public sealed class GetSermonsQueryHandler(IYoutubeService youtubeService, IAlifeDbContext dbContext)
    : IRequestHandler<GetSermonsQuery, AppResult<IReadOnlyList<SermonDto>>>
{
    public async Task<AppResult<IReadOnlyList<SermonDto>>> Handle(GetSermonsQuery request, CancellationToken cancellationToken)
    {
        await youtubeService.SyncSermonsAsync(cancellationToken);

        var sermons = await dbContext.Sermons
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenByDescending(x => x.PreachedAtUtc)
            .Select(x => new SermonDto(
                x.Id,
                x.Title,
                x.SpeakerName,
                x.ThumbnailUrl,
                x.VideoUrl,
                x.PreachedAtUtc))
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<SermonDto>>.Success(sermons);
    }
}
