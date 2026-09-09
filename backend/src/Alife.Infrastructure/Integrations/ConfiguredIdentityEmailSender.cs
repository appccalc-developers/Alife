using Alife.Application.IdentityAccess;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Integrations;

/// <summary>One selected provider for invitations and deployment administrator mail.</summary>
public sealed class ConfiguredIdentityEmailSender(
    IConfiguration configuration,
    SmtpIdentityEmailSender smtp,
    Microsoft365IdentityEmailSender microsoft365) : IIdentityEmailSender
{
    private IIdentityEmailSender? Provider => configuration["IdentityEmail:Provider"]?.Trim().ToLowerInvariant() switch
    {
        "smtp" => smtp,
        "microsoft365" => microsoft365,
        // Preserve the original Graph configuration when no selector was configured.
        null or "" => microsoft365,
        _ => null
    };

    public bool IsAvailable => Provider?.IsAvailable == true;

    public Task<IdentityMessageResult> SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken) =>
        Provider?.SendAsync(recipient, subject, body, cancellationToken) ??
        Task.FromResult(new IdentityMessageResult(false, "email_provider_unavailable"));
}
