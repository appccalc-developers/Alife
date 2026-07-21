using System.Net;
using System.Text.Json;
using Alife.Infrastructure.Integrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Alife.Tests.Unit.Infrastructure;

public class CloudflareSpeedLayerCacheServiceTests
{
    [Fact]
    public async Task PurgeApiPathsAsync_WhenConfigured_PostsInternalPurgeEndpoint()
    {
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var service = CreateService(handler, new Dictionary<string, string?>
        {
            ["Cloudflare:SyncWorkerBaseUrl"] = "https://ccalc.live",
            ["Cloudflare:SyncApiToken"] = "sync-secret",
        });

        await service.PurgeApiPathsAsync(new[] { "/api/sermons" });

        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("https://ccalc.live/api/internal/cache/invalidate", request.RequestUri?.ToString());
        Assert.Equal("Bearer", request.AuthorizationScheme);
        Assert.Equal("sync-secret", request.AuthorizationParameter);

        using var body = JsonDocument.Parse(request.Body);
        var paths = body.RootElement.GetProperty("paths");
        Assert.Equal("/api/sermons", paths[0].GetString());
    }

    [Fact]
    public async Task PurgeApiPathsAsync_WhenGlobalPurgeConfigured_PurgesSermonCacheTag()
    {
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var service = CreateService(handler, new Dictionary<string, string?>
        {
            ["Cloudflare:SyncWorkerBaseUrl"] = "https://ccalc.live",
            ["Cloudflare:SyncApiToken"] = "sync-secret",
            ["Cloudflare:ZoneId"] = "zone-id",
            ["Cloudflare:ApiToken"] = "api-secret",
        });

        await service.PurgeApiPathsAsync(new[] { "/api/sermons" });

        Assert.Equal(2, handler.Requests.Count);
        var globalRequest = Assert.Single(
            handler.Requests,
            request => request.RequestUri?.Host == "api.cloudflare.com");
        Assert.Equal(HttpMethod.Post, globalRequest.Method);
        Assert.Equal(
            "https://api.cloudflare.com/client/v4/zones/zone-id/purge_cache",
            globalRequest.RequestUri?.ToString());
        Assert.Equal("Bearer", globalRequest.AuthorizationScheme);
        Assert.Equal("api-secret", globalRequest.AuthorizationParameter);

        using var body = JsonDocument.Parse(globalRequest.Body);
        var tags = body.RootElement.GetProperty("tags");
        Assert.Equal("alife-sermons", tags[0].GetString());
    }

    [Fact]
    public async Task PurgeApiPathsAsync_WhenGlobalPurgeConfigured_PurgesPublicPagesCacheTag()
    {
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var service = CreateService(handler, new Dictionary<string, string?>
        {
            ["Cloudflare:SyncWorkerBaseUrl"] = "https://ccalc.live",
            ["Cloudflare:SyncApiToken"] = "sync-secret",
            ["Cloudflare:ZoneId"] = "zone-id",
            ["Cloudflare:ApiToken"] = "api-secret",
        });

        await service.PurgeApiPathsAsync(new[] { "/api/pages/public" });

        var globalRequest = Assert.Single(
            handler.Requests,
            request => request.RequestUri?.Host == "api.cloudflare.com");
        using var body = JsonDocument.Parse(globalRequest.Body);
        var tags = body.RootElement.GetProperty("tags");
        Assert.Equal("alife-public-pages", tags[0].GetString());
    }

    [Fact]
    public async Task PurgeApiPathsAsync_WhenConfigurationMissing_DoesNotSendRequestOrThrow()
    {
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var service = CreateService(handler, []);

        await service.PurgeApiPathsAsync(new[] { "/api/sermons" });

        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task PurgeApiPathsAsync_WhenHttpFails_DoesNotThrow()
    {
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var service = CreateService(handler, new Dictionary<string, string?>
        {
            ["Cloudflare:SyncWorkerBaseUrl"] = "https://ccalc.live",
            ["Cloudflare:SyncApiToken"] = "sync-secret",
        });

        await service.PurgeApiPathsAsync(new[] { "/api/sermons" });

        Assert.Single(handler.Requests);
    }

    private static CloudflareSpeedLayerCacheService CreateService(
        RecordingHandler handler,
        IEnumerable<KeyValuePair<string, string?>> settings)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();

        return new CloudflareSpeedLayerCacheService(
            new HttpClient(handler),
            configuration,
            NullLogger<CloudflareSpeedLayerCacheService>.Instance);
    }

    private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory) : HttpMessageHandler
    {
        public List<RecordedRequest> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(new RecordedRequest(
                request.Method,
                request.RequestUri,
                request.Headers.Authorization?.Scheme,
                request.Headers.Authorization?.Parameter,
                request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken)));

            return responseFactory(request);
        }
    }

    private sealed record RecordedRequest(
        HttpMethod Method,
        Uri? RequestUri,
        string? AuthorizationScheme,
        string? AuthorizationParameter,
        string Body);
}
