using System.Security.Cryptography;
using System.Text;
using Alife.Application.IdentityAccess;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Alife.Infrastructure.Security;

public sealed class IdentityTokenService : IIdentityTokenService
{
    private readonly byte[] tokenKey;
    private readonly byte[] lookupKey;

    public IdentityTokenService(IConfiguration configuration, IHostEnvironment environment)
    {
        tokenKey = ReadKey(configuration["TokenProtection:SigningKey"] ?? configuration["Jwt:Key"], "TokenProtection:SigningKey", environment);
        lookupKey = ReadKey(configuration["RateLimiting:HashKey"] ?? configuration["TokenProtection:SigningKey"] ?? configuration["Jwt:Key"], "RateLimiting:HashKey", environment);
    }

    public string CreateSecret(int byteLength = 32)
        => Base64UrlEncode(RandomNumberGenerator.GetBytes(byteLength));

    public byte[] HashToken(string value) => Compute(tokenKey, value);

    public byte[] HashLookup(string value) => Compute(lookupKey, value.Trim().ToUpperInvariant());

    public bool VerifyToken(string value, byte[] expectedHash)
        => CryptographicOperations.FixedTimeEquals(HashToken(value), expectedHash);

    public string SignGroupInvite(string selector, int version)
        => Base64UrlEncode(Compute(tokenKey, $"group-invite\n{selector}\n{version}"));

    public bool VerifyGroupInvite(string selector, int version, string signature)
    {
        try
        {
            return CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(SignGroupInvite(selector, version)),
                Encoding.ASCII.GetBytes(signature));
        }
        catch
        {
            return false;
        }
    }

    private static byte[] Compute(byte[] key, string value)
        => HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(value));

    private static byte[] ReadKey(string? value, string name, IHostEnvironment environment)
    {
        var normalized = value?.Trim();
        if (!string.IsNullOrWhiteSpace(normalized) && Encoding.UTF8.GetByteCount(normalized) >= 32)
        {
            return SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        }

        if (environment.IsProduction())
        {
            throw new InvalidOperationException($"{name} must contain at least 32 bytes in Production.");
        }

        return SHA256.HashData(Encoding.UTF8.GetBytes($"alife-local-only-{name}-replace-before-production"));
    }

    private static string Base64UrlEncode(byte[] value)
        => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
