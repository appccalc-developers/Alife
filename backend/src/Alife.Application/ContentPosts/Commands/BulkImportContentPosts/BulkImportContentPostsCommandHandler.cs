using System.Security.Cryptography;
using System.Text;
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

namespace Alife.Application.ContentPosts.Commands.BulkImportContentPosts;

public sealed class BulkImportContentPostsCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IContentPostCacheInvalidationService cacheInvalidationService)
    : IRequestHandler<BulkImportContentPostsCommand, AppResult<ContentPostImportReportDto>>
{
    private const int MaxBatchItems = 500;
    private const long MaxBatchTextCharacters = 25_000_000;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<AppResult<ContentPostImportReportDto>> Handle(
        BulkImportContentPostsCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Items.Count is < 1 or > MaxBatchItems)
        {
            return AppResult<ContentPostImportReportDto>.Validation(
                $"An import batch must contain between 1 and {MaxBatchItems} items.");
        }
        if (MeasureBatch(request.Items) > MaxBatchTextCharacters)
        {
            return AppResult<ContentPostImportReportDto>.Validation(
                $"An import batch cannot exceed {MaxBatchTextCharacters:N0} text characters.");
        }

        var group = await dbContext.Groups.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<ContentPostImportReportDto>.NotFound("Group not found.");
        }
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            group.Id,
            request.CurrentMemberId,
            cancellationToken))
        {
            return AppResult<ContentPostImportReportDto>.Forbidden(
                "Only church leaders and co-leaders can import historical content posts.");
        }
        if (!group.IsChurch)
        {
            return AppResult<ContentPostImportReportDto>.Validation(
                "Historical public content can only be imported into a church root group.");
        }

        var startedUtc = DateTime.UtcNow;
        var batchId = Guid.NewGuid();
        var existingPosts = await dbContext.ContentPosts
            .IgnoreQueryFilters()
            .Where(x => x.OwnerGroupId == group.Id)
            .ToListAsync(cancellationToken);
        var existingBySourceKey = existingPosts
            .Where(x => !string.IsNullOrWhiteSpace(x.SourceKey))
            .GroupBy(x => x.SourceKey!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);
        var activeBySlug = existingPosts
            .Where(x => !x.IsDeleted)
            .GroupBy(x => x.Slug, StringComparer.Ordinal)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.Ordinal);
        var activeByChecksum = existingPosts
            .Where(x => !x.IsDeleted && !string.IsNullOrWhiteSpace(x.SourceChecksum))
            .GroupBy(x => x.SourceChecksum!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

        var seenSourceKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenChecksums = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var plannedSlugs = new HashSet<string>(StringComparer.Ordinal);
        var reports = new List<ContentPostImportItemReportDto>(request.Items.Count);
        var publicSlugsToInvalidate = new HashSet<string>(StringComparer.Ordinal);

        for (var index = 0; index < request.Items.Count; index++)
        {
            var item = request.Items[index];
            var normalization = Normalize(item);
            if (normalization.Item is null)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Invalid,
                    false,
                    normalization.ReasonCode,
                    normalization.MessageEn,
                    normalization.MessageZh));
                continue;
            }

            var normalized = normalization.Item;
            if (!seenSourceKeys.Add(normalized.SourceKey))
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Duplicate,
                    false,
                    "duplicateSourceInBatch",
                    "Another item in this batch uses the same canonical source URL.",
                    "此批次中的另一条记录使用了相同的规范来源网址。"));
                continue;
            }
            if (!seenChecksums.Add(normalized.SourceChecksum))
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Duplicate,
                    false,
                    "duplicateContentInBatch",
                    "Another item in this batch has identical normalized content.",
                    "此批次中的另一条记录具有完全相同的规范化内容。"));
                continue;
            }
            if (request.Publish && normalized.PublishedUtc is null)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Invalid,
                    false,
                    "missingPublishedUtc",
                    "A historical publication date is required when importing directly as published.",
                    "直接导入为已发布文章时，必须提供历史发布日期。"));
                continue;
            }
            if (request.Publish && normalized.Warnings.Count > 0)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Conflict,
                    false,
                    "sourceWarningsRequireReview",
                    "Items with extraction warnings must be reviewed and have their warnings cleared before direct publication.",
                    "含提取警告的记录必须先人工检查并清除警告，才能直接发布。"));
                continue;
            }

            existingBySourceKey.TryGetValue(normalized.SourceKey, out var existingBySource);
            if (existingBySource?.IsDeleted == true)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Conflict,
                    false,
                    "deletedSourceConflict",
                    "This source URL belongs to a previously deleted content post.",
                    "此来源网址属于一篇已删除的历史文章。"));
                continue;
            }

            var sourceContentMatches = existingBySource is not null &&
                string.Equals(
                    existingBySource.SourceChecksum?.Trim(),
                    normalized.SourceChecksum,
                    StringComparison.OrdinalIgnoreCase);
            var publishExistingDraft = sourceContentMatches &&
                request.Publish &&
                existingBySource!.Status != ContentPostStatus.Published;
            if (sourceContentMatches && !publishExistingDraft)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Unchanged,
                    false,
                    "unchanged",
                    "The source URL and normalized content already match the stored post.",
                    "来源网址及规范化内容与现有文章完全一致。",
                    existingBySource!.Id));
                continue;
            }

            if (existingBySource?.Status == ContentPostStatus.Published &&
                !request.Publish)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Conflict,
                    false,
                    "publishedUpdateRequiresPublish",
                    "Updating an already published post requires publish=true so publication checks are applied.",
                    "更新已发布文章时必须设置 publish=true，以确保执行发布检查。",
                    existingBySource.Id));
                continue;
            }

            if (activeByChecksum.TryGetValue(normalized.SourceChecksum, out var checksumMatch) &&
                checksumMatch.Id != existingBySource?.Id)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Duplicate,
                    false,
                    "existingContentDuplicate",
                    "An existing content post has identical normalized content under another source URL.",
                    "另一来源网址下已有内容完全相同的文章。",
                    checksumMatch.Id));
                continue;
            }

            if (activeBySlug.TryGetValue(normalized.Slug, out var slugMatch) &&
                slugMatch.Id != existingBySource?.Id)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Conflict,
                    false,
                    "slugConflict",
                    "The generated slug is already used by another content post.",
                    "生成的短网址已被另一篇文章使用。",
                    slugMatch.Id));
                continue;
            }
            if (!plannedSlugs.Add(normalized.Slug))
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.Conflict,
                    false,
                    "slugConflictInBatch",
                    "Another item in this batch resolves to the same slug.",
                    "此批次中的另一条记录生成了相同的短网址。"));
                continue;
            }

            if (existingBySource is not null &&
                !sourceContentMatches &&
                !request.UpdateChanged)
            {
                reports.Add(CreateReport(
                    index,
                    item.SourceUrl,
                    normalization,
                    ContentPostImportDisposition.ChangedSkipped,
                    false,
                    "sourceChanged",
                    "The source content changed; enable updateChanged after reviewing the dry-run report.",
                    "来源内容已经变化；请审阅预览报告后再启用 updateChanged。",
                    existingBySource.Id));
                continue;
            }

            var disposition = existingBySource is null
                ? ContentPostImportDisposition.Create
                : ContentPostImportDisposition.Update;
            Guid? contentPostId = existingBySource?.Id;
            var applied = false;
            if (!request.DryRun)
            {
                var post = existingBySource ?? new ContentPost
                {
                    Id = Guid.NewGuid(),
                    OwnerGroupId = group.Id,
                    CreatedByMemberId = request.CurrentMemberId,
                    Status = request.Publish ? ContentPostStatus.Published : ContentPostStatus.Draft,
                    Visibility = ContentPostVisibility.Public,
                    CreatedUtc = DateTime.UtcNow
                };
                var wasPublic = post.Status == ContentPostStatus.Published &&
                    post.Visibility == ContentPostVisibility.Public;
                var oldSlug = post.Slug;
                var before = existingBySource is null ? null : ContentPostMapper.ToAuditSnapshot(post);

                Apply(normalized, post, request.Publish);
                if (existingBySource is null)
                {
                    dbContext.ContentPosts.Add(post);
                }

                dbContext.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    ActorMemberId = request.CurrentMemberId,
                    Action = existingBySource is null
                        ? ContentPostAuditActions.ImportCreate
                        : ContentPostAuditActions.ImportUpdate,
                    EntityType = "content_post",
                    EntityId = post.Id,
                    GroupId = group.Id,
                    BeforeJson = before is null ? null : JsonSerializer.Serialize(before, JsonOptions),
                    AfterJson = JsonSerializer.Serialize(new
                    {
                        BatchId = batchId,
                        Post = ContentPostMapper.ToAuditSnapshot(post),
                        SourceWarnings = normalized.Warnings
                    }, JsonOptions),
                    OccurredUtc = post.UpdatedUtc
                });

                var isPublic = post.Status == ContentPostStatus.Published &&
                    post.Visibility == ContentPostVisibility.Public;
                if (wasPublic || isPublic)
                {
                    if (!string.IsNullOrWhiteSpace(oldSlug))
                    {
                        publicSlugsToInvalidate.Add(oldSlug);
                    }
                    publicSlugsToInvalidate.Add(post.Slug);
                }

                contentPostId = post.Id;
                applied = true;
            }

            var reasonCode = disposition == ContentPostImportDisposition.Create
                ? "create"
                : publishExistingDraft
                    ? "publish"
                    : "update";
            reports.Add(CreateReport(
                index,
                item.SourceUrl,
                normalization,
                disposition,
                applied,
                reasonCode,
                disposition == ContentPostImportDisposition.Create
                    ? "The item will create a new content post."
                    : publishExistingDraft
                        ? "The reviewed draft will be published."
                        : "The changed source will update the existing content post.",
                disposition == ContentPostImportDisposition.Create
                    ? "此记录将创建一篇新文章。"
                    : publishExistingDraft
                        ? "已审阅的草稿将被发布。"
                        : "变化后的来源内容将更新现有文章。",
                contentPostId));
        }

        if (!request.DryRun && reports.Any(x => x.Applied))
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            if (publicSlugsToInvalidate.Count > 0)
            {
                await cacheInvalidationService.RemovePublicBatchAsync(
                    group.Id,
                    publicSlugsToInvalidate,
                    cancellationToken);
            }
        }

        var completedUtc = DateTime.UtcNow;
        var report = new ContentPostImportReportDto(
            batchId,
            request.DryRun,
            request.Publish,
            request.UpdateChanged,
            reports.Count,
            reports.Count(x => x.Disposition == ContentPostImportDisposition.Create),
            reports.Count(x => x.Disposition == ContentPostImportDisposition.Update),
            reports.Count(x => x.Disposition == ContentPostImportDisposition.Unchanged),
            reports.Count(x => x.Disposition == ContentPostImportDisposition.Duplicate),
            reports.Count(x => x.Disposition == ContentPostImportDisposition.Conflict),
            reports.Count(x => x.Disposition == ContentPostImportDisposition.Invalid),
            reports.Count(x => x.Disposition == ContentPostImportDisposition.ChangedSkipped),
            reports.Count(x => x.Warnings.Count > 0),
            startedUtc,
            completedUtc,
            reports);
        return AppResult<ContentPostImportReportDto>.Success(report);
    }

    private static void Apply(
        NormalizedImportItem source,
        ContentPost target,
        bool publish)
    {
        var now = DateTime.UtcNow;
        target.TitleJson = ContentPostMapper.WriteLocalized(source.Title);
        target.SummaryJson = ContentPostMapper.WriteLocalized(source.Summary);
        target.BodyJson = ContentPostMapper.WriteLocalized(source.Body);
        target.Category = source.Category;
        target.Visibility = ContentPostVisibility.Public;
        target.Slug = source.Slug;
        target.CoverImageUrl = source.CoverImageUrl;
        target.Byline = source.Byline;
        target.PublishedUtc = source.PublishedUtc ?? target.PublishedUtc;
        target.SourceUrl = source.CanonicalSourceUrl;
        target.SourceKey = source.SourceKey;
        target.SourceChecksum = source.SourceChecksum;
        target.UpdatedUtc = now;
        if (publish)
        {
            target.Status = ContentPostStatus.Published;
        }
    }

    private static NormalizationResult Normalize(ContentPostImportItemDto item)
    {
        var warnings = NormalizeWarnings(item.SourceWarnings);
        if (!TryCanonicalizeSourceUrl(item.SourceUrl, out var canonicalSourceUrl))
        {
            return NormalizationResult.Invalid(
                "invalidSourceUrl",
                "Source URL must be an absolute HTTP or HTTPS URL without credentials.",
                "来源网址必须是没有用户凭据的绝对 HTTP 或 HTTPS 网址。",
                warnings);
        }
        if (canonicalSourceUrl.Length > 1200)
        {
            return NormalizationResult.Invalid(
                "sourceUrlTooLong",
                "Canonical source URL must be 1200 characters or fewer.",
                "规范来源网址不能超过1200个字符。",
                warnings);
        }
        if (warnings.Count > 50 || warnings.Any(x => x.Length > 1200))
        {
            return NormalizationResult.Invalid(
                "invalidSourceWarnings",
                "Source warnings are limited to 50 values of 1200 characters each.",
                "来源警告最多50条，每条不能超过1200个字符。",
                warnings);
        }
        if (!Enum.IsDefined(item.Category))
        {
            return NormalizationResult.Invalid(
                "invalidCategory",
                "Content post category is invalid.",
                "文章分类无效。",
                warnings);
        }

        var title = ContentPostMapper.NormalizeLocalized(item.Title);
        var summary = ContentPostMapper.NormalizeLocalized(item.Summary);
        var body = ContentPostMapper.NormalizeLocalized(item.Body);
        var contentValidation = ContentPostRules.ValidateLocalizedContent(title, summary, body);
        if (contentValidation is not null)
        {
            return NormalizationResult.Invalid(
                "invalidLocalizedContent",
                contentValidation,
                "标题、摘要或正文缺失，或超过允许的长度。",
                warnings);
        }

        var publishedUtc = NormalizeDate(item.PublishedUtc);
        if (publishedUtc > DateTime.UtcNow)
        {
            return NormalizationResult.Invalid(
                "futurePublishedUtc",
                "Historical publication date cannot be in the future.",
                "历史发布日期不能位于未来。",
                warnings);
        }
        var coverImageUrl = ContentPostRules.NormalizeOptional(item.CoverImageUrl);
        if (coverImageUrl?.Length > 1200 ||
            coverImageUrl is not null && !IsHttpUrl(coverImageUrl))
        {
            return NormalizationResult.Invalid(
                "invalidCoverImageUrl",
                "Cover image URL must be an absolute HTTP/HTTPS URL of 1200 characters or fewer.",
                "封面图片必须是长度不超过1200字符的绝对 HTTP/HTTPS 网址。",
                warnings);
        }
        var byline = ContentPostRules.NormalizeOptional(item.Byline);
        if (byline?.Length > 200)
        {
            return NormalizationResult.Invalid(
                "bylineTooLong",
                "Byline must be 200 characters or fewer.",
                "作者署名不能超过200个字符。",
                warnings);
        }

        var sourceKey = Sha256(canonicalSourceUrl);
        var slugSeed = ContentPostRules.NormalizeOptional(item.Slug)
            ?? title.GetValueOrDefault("en")
            ?? title.GetValueOrDefault("zh");
        var deterministicId = Guid.ParseExact(sourceKey[..32], "N");
        var slug = ContentPostRules.NormalizeSlug(slugSeed, deterministicId);
        var checksum = ComputeChecksum(
            title,
            summary,
            body,
            item.Category,
            coverImageUrl,
            byline,
            publishedUtc);

        return NormalizationResult.Valid(new NormalizedImportItem(
            canonicalSourceUrl,
            sourceKey,
            checksum,
            title,
            summary,
            body,
            item.Category,
            slug,
            coverImageUrl,
            byline,
            publishedUtc,
            warnings));
    }

    private static ContentPostImportItemReportDto CreateReport(
        int index,
        string sourceUrl,
        NormalizationResult normalization,
        ContentPostImportDisposition disposition,
        bool applied,
        string reasonCode,
        string messageEn,
        string messageZh,
        Guid? contentPostId = null)
        => new(
            index,
            sourceUrl,
            normalization.Item?.CanonicalSourceUrl,
            normalization.Item?.SourceKey,
            normalization.Item?.SourceChecksum,
            normalization.Item?.Slug,
            contentPostId,
            disposition,
            applied,
            reasonCode,
            new Dictionary<string, string>
            {
                ["en"] = messageEn,
                ["zh"] = messageZh
            },
            normalization.Item?.Warnings ?? normalization.Warnings);

    private static IReadOnlyList<string> NormalizeWarnings(IReadOnlyList<string>? values)
        => values?
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray()
            ?? [];

    private static DateTime? NormalizeDate(DateTime? value)
        => value switch
        {
            null => null,
            { Kind: DateTimeKind.Unspecified } date => DateTime.SpecifyKind(date, DateTimeKind.Utc),
            { } date => date.ToUniversalTime()
        };

    private static bool IsHttpUrl(string value)
        => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            uri.Scheme is "http" or "https" &&
            string.IsNullOrEmpty(uri.UserInfo);

    private static bool TryCanonicalizeSourceUrl(string value, out string canonical)
    {
        canonical = string.Empty;
        if (!Uri.TryCreate(value?.Trim(), UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https") ||
            !string.IsNullOrEmpty(uri.UserInfo))
        {
            return false;
        }

        var builder = new UriBuilder(uri)
        {
            Fragment = string.Empty,
            Host = uri.Host.Equals("www.nzalc.org", StringComparison.OrdinalIgnoreCase)
                ? "nzalc.org"
                : uri.Host.ToLowerInvariant()
        };
        if (builder.Host.Equals("nzalc.org", StringComparison.OrdinalIgnoreCase))
        {
            builder.Scheme = "https";
            builder.Port = -1;
        }
        else if (uri.IsDefaultPort)
        {
            builder.Port = -1;
        }

        var query = builder.Query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Where(x => !x.StartsWith("utm_", StringComparison.OrdinalIgnoreCase))
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();
        builder.Query = string.Join("&", query);
        var path = builder.Path;
        if (path.Length > 1)
        {
            builder.Path = path.TrimEnd('/');
        }

        canonical = builder.Uri.AbsoluteUri;
        return true;
    }

    private static string ComputeChecksum(
        IReadOnlyDictionary<string, string> title,
        IReadOnlyDictionary<string, string> summary,
        IReadOnlyDictionary<string, string> body,
        ContentPostCategory category,
        string? coverImageUrl,
        string? byline,
        DateTime? publishedUtc)
    {
        var json = JsonSerializer.Serialize(new
        {
            Title = title,
            Summary = summary,
            Body = body,
            Category = category,
            CoverImageUrl = coverImageUrl,
            Byline = byline,
            PublishedUtc = publishedUtc
        }, JsonOptions);
        return Sha256(json);
    }

    private static string Sha256(string value)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static long MeasureBatch(IReadOnlyList<ContentPostImportItemDto> items)
        => items.Sum(item =>
            (long)(item.SourceUrl?.Length ?? 0) +
            Measure(item.Title) +
            Measure(item.Summary) +
            Measure(item.Body) +
            (item.Slug?.Length ?? 0) +
            (item.CoverImageUrl?.Length ?? 0) +
            (item.Byline?.Length ?? 0) +
            (item.SourceWarnings?.Sum(x => x?.Length ?? 0) ?? 0));

    private static long Measure(IReadOnlyDictionary<string, string>? value)
        => value?.Sum(x => (long)x.Key.Length + (x.Value?.Length ?? 0)) ?? 0;

    private sealed record NormalizedImportItem(
        string CanonicalSourceUrl,
        string SourceKey,
        string SourceChecksum,
        IReadOnlyDictionary<string, string> Title,
        IReadOnlyDictionary<string, string> Summary,
        IReadOnlyDictionary<string, string> Body,
        ContentPostCategory Category,
        string Slug,
        string? CoverImageUrl,
        string? Byline,
        DateTime? PublishedUtc,
        IReadOnlyList<string> Warnings);

    private sealed record NormalizationResult(
        NormalizedImportItem? Item,
        string ReasonCode,
        string MessageEn,
        string MessageZh,
        IReadOnlyList<string> Warnings)
    {
        public static NormalizationResult Valid(NormalizedImportItem item)
            => new(item, string.Empty, string.Empty, string.Empty, item.Warnings);

        public static NormalizationResult Invalid(
            string reasonCode,
            string messageEn,
            string messageZh,
            IReadOnlyList<string> warnings)
            => new(null, reasonCode, messageEn, messageZh, warnings);
    }
}
