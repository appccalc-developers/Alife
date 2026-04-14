namespace Alife.Application.Abstractions.Integrations;

public interface IYoutubeService
{
	Task SyncSermonsAsync(CancellationToken cancellationToken = default);
}