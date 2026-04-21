using Alife.Application.Abstractions.Integrations;
using Microsoft.Azure.Functions.Worker;
namespace Alife.Api;

internal sealed class SermonSyncFunction(IServiceProvider serviceProvider, ILogger<SermonSyncFunction> logger)
{
    [Function("SermonSync")]
    public async Task Run([TimerTrigger("0 */30 * * * *")] TimerInfo timer, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = serviceProvider.CreateScope();
            var youtubeService = scope.ServiceProvider.GetRequiredService<IYoutubeService>();
            await youtubeService.SyncSermonsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in sermon sync function");
        }
    }
}