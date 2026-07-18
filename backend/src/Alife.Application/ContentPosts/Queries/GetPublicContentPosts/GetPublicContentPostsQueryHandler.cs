using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using Alife.Application.ContentPosts.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.ContentPosts.Queries.GetPublicContentPosts;

public sealed class GetPublicContentPostsQueryHandler(
    IAlifeDbContext dbContext,
    IContentPostReadService contentPostReadService)
    : IRequestHandler<GetPublicContentPostsQuery, AppResult<IReadOnlyList<ContentPostSummaryDto>>>
{
    public async Task<AppResult<IReadOnlyList<ContentPostSummaryDto>>> Handle(
        GetPublicContentPostsQuery request,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.Groups.AsNoTracking().AnyAsync(x => x.Id == request.GroupId, cancellationToken))
        {
            return AppResult<IReadOnlyList<ContentPostSummaryDto>>.NotFound("Group not found.");
        }

        var posts = await contentPostReadService.GetPublicIndexAsync(request.GroupId, cancellationToken);
        return AppResult<IReadOnlyList<ContentPostSummaryDto>>.Success(posts);
    }
}
