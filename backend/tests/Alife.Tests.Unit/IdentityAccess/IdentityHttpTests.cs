using System.Net;
using Alife.Api.Controllers;
using Alife.Api.Identity;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.IdentityAccess;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed class IdentityHttpTests
{
    [Fact]
    public void ClientKey_IgnoresForwardedAddressFromUnconfiguredLoopbackPeer()
    {
        var request = CreateRequest(IPAddress.Loopback, "203.0.113.25");

        var result = IdentityHttp.GetClientRateLimitKey(request, new ConfigurationBuilder().Build());

        Assert.Equal("127.0.0.1", result);
    }

    [Fact]
    public void ClientKey_UsesForwardedAddressOnlyForConfiguredProxyNetwork()
    {
        var request = CreateRequest(IPAddress.Parse("10.20.30.40"), "203.0.113.25");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TrustedProxyNetworks:0"] = "10.20.0.0/16"
        }).Build();

        var result = IdentityHttp.GetClientRateLimitKey(request, configuration);

        Assert.Equal("203.0.113.25", result);
    }

    [Fact]
    public void ClientKey_FallsBackToPeerWhenTrustedProxyHeaderIsInvalid()
    {
        var request = CreateRequest(IPAddress.Parse("10.20.30.40"), "not-an-address");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TrustedProxyNetworks:0"] = "10.20.30.40/32"
        }).Build();

        var result = IdentityHttp.GetClientRateLimitKey(request, configuration);

        Assert.Equal("10.20.30.40", result);
    }

    [Fact]
    public void LegacyAccountLogin_Returns404WithPrivateNoStoreHeaders()
    {
        var context = new DefaultHttpContext();
        var controller = new MembersController(
            Substitute.For<IMediator>(),
            Substitute.For<ICurrentMemberAccessor>(),
            new ConfigurationBuilder().Build(),
            Substitute.For<ILineLoginService>(),
            Substitute.For<IIdentityAccessService>())
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };

        var result = controller.LoginByAccount();

        Assert.IsType<NotFoundResult>(result);
        Assert.Equal("private, no-store", context.Response.Headers.CacheControl);
        Assert.Contains("Cookie", context.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", context.Response.Headers.Vary.ToString());
    }

    private static HttpRequest CreateRequest(IPAddress peer, string forwarded)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = peer;
        context.Request.Headers["CF-Connecting-IP"] = forwarded;
        return context.Request;
    }
}
