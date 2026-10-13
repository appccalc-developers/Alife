using Alife.Application.Events.Services;
using Microsoft.Azure.Functions.Worker;
namespace Alife.Api;
public sealed class EventRegistrationExpiryFunction(EventRegistrationWorkService registration, EventWriteFreezeState freezeState)
{
    [Function("EventRegistrationExpiry")]
    public async Task Run([TimerTrigger("0 */1 * * * *")] TimerInfo timer, CancellationToken ct)
    {
        freezeState.AcknowledgeScheduledJob(EventScheduledJob.RegistrationExpiry);
        using var mutation = freezeState.TryEnterMutation();
        if (mutation is null) return;

        await registration.ExpireDueAsync(ct);
    }
}
