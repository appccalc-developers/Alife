using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using Alife.Application.ContentPosts.Services;
using MediatR;

namespace Alife.Application.ContentPosts.Queries.GetPublicContentPostBySlug;

public sealed class GetPublicContentPostBySlugQueryHandler(IContentPostReadService contentPostReadService)
    : IRequestHandler<GetPublicContentPostBySlugQuery, AppResult<ContentPostDetailDto>>
{
    public async Task<AppResult<ContentPostDetailDto>> Handle(
        GetPublicContentPostBySlugQuery request,
        CancellationToken cancellationToken)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();
        if (!ContentPostRules.IsValidSlug(slug))
        {
            return AppResult<ContentPostDetailDto>.NotFound("Content post was not found.");
        }

        var post = await contentPostReadService.GetPublicDetailAsync(request.GroupId, slug, cancellationToken);
        return post is null
            ? AppResult<ContentPostDetailDto>.NotFound("Content post was not found.")
            : AppResult<ContentPostDetailDto>.Success(post);
    }
}
