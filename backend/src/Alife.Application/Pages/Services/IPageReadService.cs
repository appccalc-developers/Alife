using Alife.Application.Pages.Dtos;

namespace Alife.Application.Pages.Services;

public interface IPageReadService
{
    Task<IReadOnlyList<PageDto>> GetGlobalPagesAsync(string lang, CancellationToken cancellationToken);
    Task<PageDto?> GetBySlugAsync(string slug, string lang, CancellationToken cancellationToken);
    Task<IReadOnlyList<PageDto>> GetGroupPagesAsync(Guid groupId, string lang, CancellationToken cancellationToken);
}
