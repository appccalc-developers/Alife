using Alife.Application.Albums;
using Alife.Application.Announcements.Dtos;
using Alife.Application.Events.Dtos;
using Alife.Application.Forum.Dtos;
using Alife.Application.Pages.Dtos;
using Alife.Domain.Enums;

namespace Alife.Application.ChurchLife;

public sealed record ChurchLifeGroupDto(
    Guid Id,
    Guid? ParentGroupId,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyList<Guid> PathIds,
    bool CanManage,
    bool IsSelectable);

public sealed record ChurchLifeListDto<T>(
    IReadOnlyList<T> Items,
    IReadOnlyList<ChurchLifeGroupDto> Groups);

public sealed record ChurchLifePagedDto<T>(
    IReadOnlyList<T> Items,
    IReadOnlyList<ChurchLifeGroupDto> Groups,
    int Page,
    int PageSize,
    int TotalCount);

public sealed record ChurchLifeScopeGroup(
    Guid Id,
    Guid? ParentGroupId,
    IReadOnlyDictionary<string, string> Name,
    AccessType AccessType,
    IReadOnlyList<Guid> PathIds,
    bool CanManage);

public sealed record ChurchLifeScope(
    Guid ChurchGroupId,
    IReadOnlyList<ChurchLifeScopeGroup> Groups,
    IReadOnlySet<Guid> ApprovedGroupIds);

public interface IChurchLifeScopeService
{
    Task<Common.Models.AppResult<ChurchLifeScope>> GetScopeAsync(Guid memberId, CancellationToken cancellationToken);
}

public interface IChurchLifeService
{
    Task<Common.Models.AppResult<ChurchLifeListDto<PageDto>>> ListPagesAsync(Guid memberId, Guid? ownerGroupId, CancellationToken cancellationToken);
    Task<Common.Models.AppResult<ChurchLifeListDto<GroupEventSummaryDto>>> ListEventsAsync(Guid memberId, Guid? ownerGroupId, CancellationToken cancellationToken);
    Task<Common.Models.AppResult<ChurchLifeListDto<AnnouncementDto>>> ListAnnouncementsAsync(Guid memberId, Guid? ownerGroupId, CancellationToken cancellationToken);
    Task<Common.Models.AppResult<ChurchLifeListDto<AlbumSummaryDto>>> ListAlbumsAsync(Guid memberId, Guid? ownerGroupId, CancellationToken cancellationToken);
    Task<Common.Models.AppResult<ChurchLifePagedDto<ForumPostSummaryDto>>> ListForumPostsAsync(
        Guid memberId,
        Guid? ownerGroupId,
        Guid? categoryId,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
}
