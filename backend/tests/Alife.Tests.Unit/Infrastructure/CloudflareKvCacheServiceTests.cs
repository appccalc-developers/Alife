using System.Net;
using System.Text.Json;
using Alife.Infrastructure.Integrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Alife.Tests.Unit.Infrastructure;

public sealed class CloudflareKvCacheServiceTests
{
    [Fact]
    public async Task RemoveApiCachesAsync_UsesOneBulkDeleteRequestWithDistinctKeys()
    {
        var handler = new RecordingHandler();
        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.cloudflare.com/client/v4/")
        };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cloudflare:AccountId"] = "account-id",
                ["Cloudflare:ApiCacheNamespaceId"] = "namespace-id",
                ["Cloudflare:ApiToken"] = "token"
            })
            .Build();
        var service = new CloudflareKvCacheService(
            client,
            configuration,
            NullLogger<CloudflareKvCacheService>.Instance);

        await service.RemoveApiCachesAsync(
            ["/api/public/groups/group-id/posts", "/api/public/groups/group-id/posts/one", "/api/public/groups/group-id/posts"]);

        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal(
            "https://api.cloudflare.com/client/v4/accounts/account-id/storage/kv/namespaces/namespace-id/bulk/delete",
            request.RequestUri?.ToString());
        using var body = JsonDocument.Parse(request.Body);
        Assert.Equal(
            [
                "api:/api/public/groups/group-id/posts",
                "api:/api/public/groups/group-id/posts/one"
            ],
            body.RootElement.EnumerateArray().Select(x => x.GetString()));
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public List<RecordedRequest> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(new RecordedRequest(
                request.Method,
                request.RequestUri,
                request.Content is null
                    ? string.Empty
                    : await request.Content.ReadAsStringAsync(cancellationToken)));
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }

    private sealed record RecordedRequest(
        HttpMethod Method,
        Uri? RequestUri,
        string Body);
}
