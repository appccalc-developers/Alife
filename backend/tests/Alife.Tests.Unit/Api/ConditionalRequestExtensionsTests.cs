using Alife.Api.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Tests.Unit.Api;

public class ConditionalRequestExtensionsTests
{
    [Fact]
    public void ApplyPrivateConditionalCacheHeaders_MatchesGeneratedEtagAndPreservesPrivateVaryHeaders()
    {
        var first = CreateController();
        var value = new[] { new { Id = 1, Name = "Group" } };

        var firstMatches = first.ApplyPrivateConditionalCacheHeaders(value);
        var etag = first.Response.Headers.ETag.ToString();

        Assert.False(firstMatches);
        Assert.StartsWith("W/\"", etag);
        Assert.Equal("private, no-cache", first.Response.Headers.CacheControl);
        Assert.Contains("Cookie", first.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", first.Response.Headers.Vary.ToString());

        var revalidation = CreateController();
        revalidation.Request.Headers.IfNoneMatch = etag;

        Assert.True(revalidation.ApplyPrivateConditionalCacheHeaders(value));
        Assert.Equal(etag, revalidation.Response.Headers.ETag.ToString());
    }

    private static ControllerBase CreateController()
        => new TestController
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

    private sealed class TestController : ControllerBase;
}
