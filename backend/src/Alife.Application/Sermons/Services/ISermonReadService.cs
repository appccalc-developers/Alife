using Alife.Application.Sermons.Dtos;

namespace Alife.Application.Sermons.Services;

public interface ISermonReadService
{
    Task<IReadOnlyList<SermonDto>> GetSermonsAsync(CancellationToken cancellationToken);
}
