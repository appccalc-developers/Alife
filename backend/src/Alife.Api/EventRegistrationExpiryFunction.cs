using Alife.Application.Events.Services;
using Microsoft.Azure.Functions.Worker;
namespace Alife.Api;
public sealed class EventRegistrationExpiryFunction(EventRegistrationWorkService registration)
{
    [Function("EventRegistrationExpiry")]
    public Task Run([TimerTrigger("0 */1 * * * *")] TimerInfo timer, CancellationToken ct) => registration.ExpireDueAsync(ct);
}
