using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.ContentPosts.Commands.DeleteContentPost;

public sealed class DeleteContentPostCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IContentPostCacheInvalidationService cacheInvalidationService)
    : IRequestHandler<DeleteContentPostCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(
        DeleteContentPostCommand request,
        CancellationToken cancellationToken)
    {
        var post = await dbContext.ContentPosts
            .FirstOrDefaultAsync(x => x.Id == request.ContentPostId, cancellationToken);
        if (post is null)
        {
            return AppResult<bool>.NotFound("Content post was not found.");
        }
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            post.OwnerGroupId,
            request.CurrentMemberId,
            cancellationToken))
        {
            return AppResult<bool>.Forbidden(
                "Only group leaders and co-leaders can delete content posts.");
        }

        var before = ContentPostMapper.ToAuditSnapshot(post);
        var now = DateTime.UtcNow;
        post.IsDeleted = true;
        post.UpdatedUtc = now;
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = ContentPostAuditActions.Delete,
            EntityType = "content_post",
            EntityId = post.Id,
            GroupId = post.OwnerGroupId,
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(ContentPostMapper.ToAuditSnapshot(post)),
            OccurredUtc = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.RemovePublicIndexAsync(post.OwnerGroupId, cancellationToken);
        await cacheInvalidationService.RemovePublicDetailAsync(post.OwnerGroupId, post.Slug, cancellationToken);
        return AppResult<bool>.Success(true);
    }
}
