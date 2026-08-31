using Alife.Application.IdentityAccess;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using System.Security.Cryptography;
using System.Text;

namespace Alife.Infrastructure.Security;

public sealed class IdentityAccessConfiguration : IIdentityAccessConfiguration
{
    public IdentityAccessConfiguration(IConfiguration configuration, IHostEnvironment environment)
    {
        IsProduction = environment.IsProduction();
        PasskeysEnabled = configuration.GetValue("Passkeys:Enabled", false);
        LineLegacyEnabled = configuration.GetValue("LineLogin:Enabled", true);
        AlphaLoginEnabled = configuration.GetValue("AlphaLogin:Enabled", false);
        FrontendBaseUrl = (configuration["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        AlphaAccounts = configuration.GetSection("AlphaLogin:Accounts")
            .GetChildren()
            .Select(section =>
            {
                var accountId = section["AccountId"]?.Trim() ?? string.Empty;
                return new AlphaAccountConfiguration(
                    accountId,
                    Guid.TryParse(section["MemberId"], out var memberId) ? memberId : Guid.Empty,
                    section["Label"]?.Trim() ?? accountId,
                    HashBootstrapCode(configuration[$"AlphaLogin:PasskeyBootstrapCodes:{accountId}"]));
            })
            .Where(account => account.AccountId.Length > 0 && account.MemberId != Guid.Empty && account.Label.Length > 0)
            .GroupBy(account => account.AccountId, StringComparer.Ordinal)
            .Select(group => group.First())
            .ToArray();
    }

    public bool PasskeysEnabled { get; }
    public bool LineLegacyEnabled { get; }
    public bool AlphaLoginEnabled { get; }
    public bool IsProduction { get; }
    public string FrontendBaseUrl { get; }
    public IReadOnlyList<AlphaAccountConfiguration> AlphaAccounts { get; }

    private static byte[]? HashBootstrapCode(string? value)
    {
        var code = value?.Trim();
        return code is { Length: >= 24 }
            ? SHA256.HashData(Encoding.UTF8.GetBytes(code))
            : null;
    }
}
