using Alife.Application.IdentityAccess;

namespace Alife.Infrastructure.Integrations;

public sealed class UnavailableIdentityMessageSender : IIdentityMessageSender
{
    public bool IsAvailable => false;

    public Task<IdentityMessageResult> SendActivationAsync(
        string phoneE164,
        string displayName,
        string activationUrl,
        string preferredLanguage,
        CancellationToken cancellationToken)
        => Task.FromResult(new IdentityMessageResult(false, "provider_unavailable"));

    public Task<IdentityMessageResult> SendApplicationResponseAsync(
        string phoneE164,
        string responseUrl,
        string preferredLanguage,
        CancellationToken cancellationToken)
        => Task.FromResult(new IdentityMessageResult(false, "provider_unavailable"));
}
