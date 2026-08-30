using Alife.Application.IdentityAccess;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Alife.Infrastructure.Security;

public sealed class IdentityAccessConfiguration : IIdentityAccessConfiguration
{
    public IdentityAccessConfiguration(IConfiguration configuration, IHostEnvironment environment)
    {
        IsProduction = environment.IsProduction();
        PasskeysEnabled = configuration.GetValue("Passkeys:Enabled", false);
        LineLegacyEnabled = configuration.GetValue("LineLogin:Enabled", true);
        ActivationMessagingAvailable = configuration.GetValue("ActivationMessages:Enabled", false);
        ExposeActivationLinks = !IsProduction && configuration.GetValue("ActivationMessages:ExposeLinks", false);
        AlphaLoginEnabled = configuration.GetValue("AlphaLogin:Enabled", false);
        FrontendBaseUrl = (configuration["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        AlphaAccounts = configuration.GetSection("AlphaLogin:Accounts")
            .GetChildren()
            .Select(section => new AlphaAccountConfiguration(
                section["AccountId"]?.Trim() ?? string.Empty,
                Guid.TryParse(section["MemberId"], out var memberId) ? memberId : Guid.Empty,
                section["Label"]?.Trim() ?? section["AccountId"]?.Trim() ?? string.Empty))
            .Where(account => account.AccountId.Length > 0 && account.MemberId != Guid.Empty && account.Label.Length > 0)
            .GroupBy(account => account.AccountId, StringComparer.Ordinal)
            .Select(group => group.First())
            .ToArray();
    }

    public bool PasskeysEnabled { get; }
    public bool LineLegacyEnabled { get; }
    public bool ActivationMessagingAvailable { get; }
    public bool ExposeActivationLinks { get; }
    public bool AlphaLoginEnabled { get; }
    public bool IsProduction { get; }
    public string FrontendBaseUrl { get; }
    public IReadOnlyList<AlphaAccountConfiguration> AlphaAccounts { get; }
}
