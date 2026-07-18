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

namespace Alife.Application.ContentPosts.Commands.ArchiveContentPost;

public sealed class ArchiveContentPostCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IContentPostCacheInvalidationService cacheInvalidationService)
    : IRequestHandler<ArchiveContentPostCommand, AppResult<ManagedContentPostDto>>
{
    public async Task<AppResult<ManagedContentPostDto>> Handle(
        ArchiveContentPostCommand request,
        CancellationToken cancellationToken)
    {
        var post = await dbContext.ContentPosts
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
                "Only group leaders and co-leaders can archive content posts.");
        }

        if (post.Status == ContentPostStatus.Archived)
        {
            return AppResult<ManagedContentPostDto>.Success(ContentPostMapper.ToManagedDto(post));
        }

        var before = ContentPostMapper.ToAuditSnapshot(post);
        var now = DateTime.UtcNow;
        post.Status = ContentPostStatus.Archived;
        post.UpdatedUtc = now;
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = ContentPostAuditActions.Archive,
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
