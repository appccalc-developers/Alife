using Alife.Application.Events.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
namespace Alife.Api;

public sealed class EventRamSyncFunction(IServiceScopeFactory scopes, EventWriteFreezeState freezeState)
{
    [Function("EventRamSync")]
    public async Task Run([TimerTrigger("*/30 * * * * *")] TimerInfo timer, CancellationToken ct)
    {
        freezeState.AcknowledgeScheduledJob(EventScheduledJob.RamSync);
        using var mutation = freezeState.TryEnterMutation();
        if (mutation is null) return;

        await using var listing = scopes.CreateAsyncScope();
        var ids = await listing.ServiceProvider.GetRequiredService<EventRamSyncService>().DueAsync(ct);
        foreach (var id in ids)
        {
            await using var job = scopes.CreateAsyncScope();
            await job.ServiceProvider.GetRequiredService<EventRamSyncService>().ProcessAsync(id, ct);
        }
    }
}
