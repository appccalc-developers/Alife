using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

public interface IEventReadService
{
    Task<IReadOnlyList<GroupEventSummaryDto>> GetGroupEventsAsync(Guid groupId, CancellationToken cancellationToken);
}
