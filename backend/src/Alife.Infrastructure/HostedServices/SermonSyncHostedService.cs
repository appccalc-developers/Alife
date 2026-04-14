using Alife.Application.Abstractions.Integrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.HostedServices;

public class SermonSyncHostedService(IServiceProvider serviceProvider, ILogger<SermonSyncHostedService> logger) : BackgroundService
{
	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		while (!stoppingToken.IsCancellationRequested)
		{
			try
			{
				using var scope = serviceProvider.CreateScope();
				var youtubeService = scope.ServiceProvider.GetRequiredService<IYoutubeService>();
				await youtubeService.SyncSermonsAsync(stoppingToken);
			}
			catch (Exception ex)
			{
				logger.LogError(ex, "Error in sermon sync hosted service");
			}

			await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
		}
	}
}