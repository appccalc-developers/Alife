using Alife.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using NSubstitute;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed class IdentityTokenServiceTests
{
    [Fact]
    public void CreateSecret_UsesBase64UrlAndFreshRandomness()
    {
        var service = CreateService();

        var first = service.CreateSecret();
        var second = service.CreateSecret();

        Assert.NotEqual(first, second);
        Assert.DoesNotContain('+', first);
        Assert.DoesNotContain('/', first);
        Assert.DoesNotContain('=', first);
    }

    [Fact]
    public void TokenHash_VerifiesOnlyTheOriginalSecret()
    {
        var service = CreateService();
        var hash = service.HashToken("correct-secret");

        Assert.True(service.VerifyToken("correct-secret", hash));
        Assert.False(service.VerifyToken("wrong-secret", hash));
    }

    [Fact]
    public void LookupHash_NormalizesCaseAndOuterWhitespace()
    {
        var service = CreateService();

        Assert.Equal(service.HashLookup(" selector "), service.HashLookup("SELECTOR"));
    }

    [Fact]
    public void GroupInviteSignature_IsBoundToSelectorAndVersion()
    {
        var service = CreateService();
        var signature = service.SignGroupInvite("selector", 4);

        Assert.True(service.VerifyGroupInvite("selector", 4, signature));
        Assert.False(service.VerifyGroupInvite("another-selector", 4, signature));
        Assert.False(service.VerifyGroupInvite("selector", 5, signature));
        Assert.False(service.VerifyGroupInvite("selector", 4, signature + "x"));
    }

    [Fact]
    public void Production_RejectsMissingTokenProtectionKey()
    {
        var environment = Substitute.For<IHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Production);

        Assert.Throws<InvalidOperationException>(() =>
            new IdentityTokenService(new ConfigurationBuilder().Build(), environment));
    }

    private static IdentityTokenService CreateService()
    {
        var values = new Dictionary<string, string?>
        {
            ["TokenProtection:SigningKey"] = "identity-token-test-key-at-least-32-bytes-long",
            ["RateLimiting:HashKey"] = "identity-rate-test-key-at-least-32-bytes-long"
        };
        var environment = Substitute.For<IHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Development);
        return new IdentityTokenService(new ConfigurationBuilder().AddInMemoryCollection(values).Build(), environment);
    }
}
