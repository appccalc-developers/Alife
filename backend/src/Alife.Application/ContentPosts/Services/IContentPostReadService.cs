using Alife.Application.ContentPosts.Dtos;

namespace Alife.Application.ContentPosts.Services;

public interface IContentPostReadService
{
    Task<IReadOnlyList<ContentPostSummaryDto>> GetPublicIndexAsync(
        Guid groupId,
        CancellationToken cancellationToken = default);

    Task<ContentPostDetailDto?> GetPublicDetailAsync(
        Guid groupId,
        string slug,
        CancellationToken cancellationToken = default);
}
