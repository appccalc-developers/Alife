using Alife.Application.IdentityAccess;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed class IdentityPathPolicyTests
{
    [Theory]
    [InlineData("/groups/abc?view=overview#today")]
    [InlineData("/tasks?type=urgent")]
    public void NormalizeReturnPath_PreservesSafeInternalTargets(string value)
        => Assert.Equal(value, IdentityPathPolicy.NormalizeReturnPath(value));

    [Theory]
    [InlineData("https://evil.example/path")]
    [InlineData("//evil.example/path")]
    [InlineData("/groups\\escape")]
    [InlineData("/onboarding")]
    [InlineData("/onboarding?returnTo=%2Fonboarding")]
    [InlineData("/onboarding/resume")]
    [InlineData("/activate/selector")]
    [InlineData("/join/selector")]
    [InlineData("/application/selector")]
    [InlineData("/internal/alpha-login")]
    public void NormalizeReturnPath_RejectsExternalMalformedAndIdentityLoops(string value)
        => Assert.Empty(IdentityPathPolicy.NormalizeReturnPath(value));
}
