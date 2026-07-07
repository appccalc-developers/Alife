using Alife.Application.Pages.Dtos;

namespace Alife.Application.Pages.Services;

public interface IPageReadService
{
    Task<IReadOnlyList<PageDto>> GetPublicPagesAsync(CancellationToken cancellationToken);
    Task<PageDetailDto?> GetByIdAsync(Guid pageId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PageDto>> GetGroupPagesAsync(Guid groupId, CancellationToken cancellationToken);
}
