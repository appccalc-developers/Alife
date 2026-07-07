using Alife.Application.Common.Models;
using Alife.Application.Sermons.Dtos;

namespace Alife.Application.Sermons.Services;

public interface ISermonReadService
{
    Task<PagedResult<SermonDto>> GetSermonsAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<SermonDto?> GetSermonByIdAsync(Guid sermonId, CancellationToken cancellationToken);
}
