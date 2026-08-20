using Alife.Application.Common.Models;

namespace Alife.Application.Albums;

public interface IAlbumService
{
    Task<AppResult<IReadOnlyList<AlbumSummaryDto>>> ListAsync(Guid groupId, Guid? currentMemberId, bool includeAll, CancellationToken cancellationToken);
    Task<IReadOnlyList<AlbumSummaryDto>> ListChurchLifeAsync(
        IReadOnlyCollection<Guid> groupIds,
        IReadOnlyCollection<Guid> approvedGroupIds,
        CancellationToken cancellationToken);
    Task<AppResult<AlbumDetailDto>> GetAsync(Guid albumId, Guid? currentMemberId, CancellationToken cancellationToken);
    Task<AppResult<AlbumDetailDto>> CreateAsync(CreateAlbumInput input, Guid currentMemberId, CancellationToken cancellationToken);
    Task<AppResult<AlbumDetailDto>> UpdateAsync(Guid albumId, UpdateAlbumInput input, Guid currentMemberId, CancellationToken cancellationToken);
    Task<AppResult<AlbumDetailDto>> AddPhotoAsync(Guid albumId, Guid fileAssetId, IReadOnlyDictionary<string, string>? caption, Guid currentMemberId, CancellationToken cancellationToken);
    Task<AppResult<AlbumDetailDto>> RemovePhotoAsync(Guid albumId, Guid photoId, Guid currentMemberId, CancellationToken cancellationToken);
    Task<AppResult<AlbumDetailDto>> ReorderPhotosAsync(Guid albumId, IReadOnlyList<Guid> photoIds, Guid currentMemberId, CancellationToken cancellationToken);
}
