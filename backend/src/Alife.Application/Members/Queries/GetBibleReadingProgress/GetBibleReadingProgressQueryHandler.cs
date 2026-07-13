using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Queries.GetBibleReadingProgress;

public sealed class GetBibleReadingProgressQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<GetBibleReadingProgressQuery, AppResult<BibleReadingProgressDto>>
{
    public async Task<AppResult<BibleReadingProgressDto>> Handle(
        GetBibleReadingProgressQuery request,
        CancellationToken cancellationToken)
    {
        var progress = await dbContext.BibleReadingProgresses
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.MemberId == request.MemberId, cancellationToken);

        return progress is null
            ? AppResult<BibleReadingProgressDto>.NotFound("Bible reading progress was not found.")
            : AppResult<BibleReadingProgressDto>.Success(new BibleReadingProgressDto(
                progress.Book,
                progress.Chapter,
                progress.Language,
                progress.ZhVersion,
                progress.EnVersion,
                progress.UpdatedUtc));
    }
}
