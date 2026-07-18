using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.ContentPosts.Queries.ListManagedContentPosts;

public sealed class ListManagedContentPostsQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<ListManagedContentPostsQuery, AppResult<IReadOnlyList<ManagedContentPostDto>>>
{
    public async Task<AppResult<IReadOnlyList<ManagedContentPostDto>>> Handle(
        ListManagedContentPostsQuery request,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.Groups.AsNoTracking().AnyAsync(x => x.Id == request.GroupId, cancellationToken))
        {
            return AppResult<IReadOnlyList<ManagedContentPostDto>>.NotFound("Group not found.");
        }

        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken))
        {
            return AppResult<IReadOnlyList<ManagedContentPostDto>>.Forbidden(
                "Only group leaders and co-leaders can manage content posts.");
        }

        var posts = await dbContext.ContentPosts
            .AsNoTracking()
            .Where(x => x.OwnerGroupId == request.GroupId)
            .OrderByDescending(x => x.PublishedUtc ?? x.UpdatedUtc)
            .ThenBy(x => x.Slug)
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<ManagedContentPostDto>>.Success(
            posts.Select(ContentPostMapper.ToManagedDto).ToList());
    }
}
