using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using Alife.Application.ContentPosts.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.ContentPosts.Commands.PublishContentPost;

public sealed class PublishContentPostCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IContentPostCacheInvalidationService cacheInvalidationService)
    : IRequestHandler<PublishContentPostCommand, AppResult<ManagedContentPostDto>>
{
    public async Task<AppResult<ManagedContentPostDto>> Handle(
        PublishContentPostCommand request,
        CancellationToken cancellationToken)
    {
        var post = await dbContext.ContentPosts
            .Include(x => x.OwnerGroup)
            .FirstOrDefaultAsync(x => x.Id == request.ContentPostId, cancellationToken);
        if (post is null)
        {
            return AppResult<ManagedContentPostDto>.NotFound("Content post was not found.");
        }

        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            post.OwnerGroupId,
            request.CurrentMemberId,
            cancellationToken))
        {
            return AppResult<ManagedContentPostDto>.Forbidden(
                "Only group leaders and co-leaders can publish content posts.");
        }

        if (post.Visibility == ContentPostVisibility.Public && !post.OwnerGroup.IsChurch)
        {
            return AppResult<ManagedContentPostDto>.Validation(
                "Only a church root group can publish public content posts.");
        }

        var now = DateTime.UtcNow;
        if (post.PublishedUtc.HasValue && post.PublishedUtc.Value > now)
        {
            return AppResult<ManagedContentPostDto>.Validation(
                "Content posts cannot be published with a future publication date.");
        }

        if (post.Status == ContentPostStatus.Published)
        {
            return AppResult<ManagedContentPostDto>.Success(ContentPostMapper.ToManagedDto(post));
        }

        var before = ContentPostMapper.ToAuditSnapshot(post);
        post.Status = ContentPostStatus.Published;
        post.PublishedUtc ??= now;
        post.UpdatedUtc = now;

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = ContentPostAuditActions.Publish,
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

        return AppResult<ManagedContentPostDto>.Success(ContentPostMapper.ToManagedDto(post));
    }
}
