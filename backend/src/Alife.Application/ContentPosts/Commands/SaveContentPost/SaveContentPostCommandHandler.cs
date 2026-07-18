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

namespace Alife.Application.ContentPosts.Commands.SaveContentPost;

public sealed class SaveContentPostCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IContentPostCacheInvalidationService cacheInvalidationService)
    : IRequestHandler<SaveContentPostCommand, AppResult<ManagedContentPostDto>>
{
    public async Task<AppResult<ManagedContentPostDto>> Handle(
        SaveContentPostCommand request,
        CancellationToken cancellationToken)
    {
        var group = await dbContext.Groups.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.OwnerGroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<ManagedContentPostDto>.NotFound("Group not found.");
        }

        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            group.Id,
            request.CurrentMemberId,
            cancellationToken))
        {
            return AppResult<ManagedContentPostDto>.Forbidden(
                "Only group leaders and co-leaders can manage content posts.");
        }

        if (request.Visibility == ContentPostVisibility.Public && !group.IsChurch)
        {
            return AppResult<ManagedContentPostDto>.Validation(
                "Only a church root group can own public content posts.");
        }

        var title = ContentPostMapper.NormalizeLocalized(request.Title);
        var summary = ContentPostMapper.NormalizeLocalized(request.Summary);
        var body = ContentPostMapper.NormalizeLocalized(request.Body);
        var validation = ContentPostRules.ValidateLocalizedContent(title, summary, body)
            ?? ValidateMetadata(request);
        if (validation is not null)
        {
            return AppResult<ManagedContentPostDto>.Validation(validation);
        }

        ContentPost post;
        object? before = null;
        var oldSlug = string.Empty;
        var action = ContentPostAuditActions.Create;
        if (request.ContentPostId.HasValue)
        {
            post = await dbContext.ContentPosts
                .FirstOrDefaultAsync(x => x.Id == request.ContentPostId.Value, cancellationToken)
                ?? null!;
            if (post is null)
            {
                return AppResult<ManagedContentPostDto>.NotFound("Content post was not found.");
            }
            if (post.OwnerGroupId != group.Id)
            {
                return AppResult<ManagedContentPostDto>.Forbidden("Content post belongs to another group.");
            }

            before = ContentPostMapper.ToAuditSnapshot(post);
            oldSlug = post.Slug;
            action = ContentPostAuditActions.Update;
        }
        else
        {
            var now = DateTime.UtcNow;
            post = new ContentPost
            {
                Id = Guid.NewGuid(),
                OwnerGroupId = group.Id,
                CreatedByMemberId = request.CurrentMemberId,
                Status = ContentPostStatus.Draft,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.ContentPosts.Add(post);
        }

        var slug = ContentPostRules.NormalizeSlug(
            string.IsNullOrWhiteSpace(request.Slug) && request.ContentPostId.HasValue ? post.Slug : request.Slug,
            post.Id);
        if (await dbContext.ContentPosts.AsNoTracking()
            .AnyAsync(x => x.OwnerGroupId == group.Id && x.Slug == slug && x.Id != post.Id, cancellationToken))
        {
            return AppResult<ManagedContentPostDto>.Conflict("A content post with this slug already exists in the group.");
        }

        var sourceKey = ContentPostRules.NormalizeHash(request.SourceKey);
        if (sourceKey is not null && await dbContext.ContentPosts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(x => x.OwnerGroupId == group.Id && x.SourceKey == sourceKey && x.Id != post.Id, cancellationToken))
        {
            return AppResult<ManagedContentPostDto>.Conflict("A content post with this source key already exists in the group.");
        }

        post.TitleJson = ContentPostMapper.WriteLocalized(title);
        post.SummaryJson = ContentPostMapper.WriteLocalized(summary);
        post.BodyJson = ContentPostMapper.WriteLocalized(body);
        post.Category = request.Category;
        post.Visibility = request.Visibility;
        post.Slug = slug;
        post.CoverImageUrl = ContentPostRules.NormalizeOptional(request.CoverImageUrl);
        post.Byline = ContentPostRules.NormalizeOptional(request.Byline);
        post.PublishedUtc = request.PublishedUtc?.ToUniversalTime();
        post.SourceUrl = ContentPostRules.NormalizeOptional(request.SourceUrl);
        post.SourceKey = sourceKey;
        post.SourceChecksum = ContentPostRules.NormalizeHash(request.SourceChecksum);
        post.UpdatedUtc = DateTime.UtcNow;

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = action,
            EntityType = "content_post",
            EntityId = post.Id,
            GroupId = post.OwnerGroupId,
            BeforeJson = before is null ? null : JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(ContentPostMapper.ToAuditSnapshot(post)),
            OccurredUtc = post.UpdatedUtc
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.RemovePublicIndexAsync(post.OwnerGroupId, cancellationToken);
        if (!string.IsNullOrWhiteSpace(oldSlug) && !oldSlug.Equals(post.Slug, StringComparison.Ordinal))
        {
            await cacheInvalidationService.RemovePublicDetailAsync(post.OwnerGroupId, oldSlug, cancellationToken);
        }
        await cacheInvalidationService.RemovePublicDetailAsync(post.OwnerGroupId, post.Slug, cancellationToken);

        return AppResult<ManagedContentPostDto>.Success(ContentPostMapper.ToManagedDto(post));
    }

    private static string? ValidateMetadata(SaveContentPostCommand request)
    {
        if (!Enum.IsDefined(request.Category))
        {
            return "Content post category is invalid.";
        }
        if (!Enum.IsDefined(request.Visibility))
        {
            return "Content post visibility is invalid.";
        }
        if (request.PublishedUtc?.ToUniversalTime() > DateTime.UtcNow)
        {
            return "Content posts cannot use a future publication date.";
        }

        var coverImageUrl = ContentPostRules.NormalizeOptional(request.CoverImageUrl);
        if (coverImageUrl?.Length > 1200)
        {
            return "Cover image URL must be 1200 characters or fewer.";
        }
        var byline = ContentPostRules.NormalizeOptional(request.Byline);
        if (byline?.Length > 200)
        {
            return "Byline must be 200 characters or fewer.";
        }
        var sourceUrl = ContentPostRules.NormalizeOptional(request.SourceUrl);
        if (sourceUrl?.Length > 1200)
        {
            return "Source URL must be 1200 characters or fewer.";
        }

        return ContentPostRules.ValidateOptionalHash(request.SourceKey, "Source key")
            ?? ContentPostRules.ValidateOptionalHash(request.SourceChecksum, "Source checksum")
            ?? (ContentPostRules.NormalizeOptional(request.SourceKey) is not null && sourceUrl is null
                ? "Source URL is required when a source key is provided."
                : null);
    }
}
