using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Integrations;

public sealed class CloudflareKvCacheService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<CloudflareKvCacheService> logger) : ICloudflareKvCacheService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex GroupScopedApiPathRegex = new(
        "^/api/groups/(?<groupId>[^/]+)/(?<kind>pages|subgroups|events|memberships|members)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public Task PutApprovedMembershipAsync(
        Guid groupId,
        Guid memberId,
        MembershipRole role,
        DateTime updatedUtc,
        CancellationToken cancellationToken = default)
        => PutAuthzValueAsync(
            $"membership:{groupId}:{memberId}",
            new
            {
                status = "approved",
                role = role.ToString(),
                updatedUtc
            },
            cancellationToken);

    public Task RemoveMembershipAsync(
        Guid groupId,
        Guid memberId,
        CancellationToken cancellationToken = default)
        => DeleteAuthzValueAsync($"membership:{groupId}:{memberId}", cancellationToken);

    public Task RemoveApiCacheAsync(string path, CancellationToken cancellationToken = default)
        => DeleteApiCacheValueAsync(CreateApiCacheKey(path), cancellationToken);

    public Task RemoveApiCacheKeyAsync(string key, CancellationToken cancellationToken = default)
        => DeleteApiCacheValueAsync(key, cancellationToken);

    private async Task PutAuthzValueAsync(string key, object value, CancellationToken cancellationToken)
    {
        var endpoint = CreateKvEndpoint(ReadOptions().AuthzNamespaceId, key, expirationTtlSeconds: 7 * 24 * 60 * 60);
        if (endpoint is null)
        {
            return;
        }

        var response = await SendAsync(() => httpClient.PutAsJsonAsync(endpoint, value, JsonOptions, cancellationToken), cancellationToken);
        LogIfUnsuccessful(response, "put", key);
    }

    private async Task DeleteAuthzValueAsync(string key, CancellationToken cancellationToken)
    {
        var endpoint = CreateKvEndpoint(ReadOptions().AuthzNamespaceId, key);
        if (endpoint is null)
        {
            return;
        }

        var response = await SendAsync(() => httpClient.DeleteAsync(endpoint, cancellationToken), cancellationToken);
        LogIfUnsuccessful(response, "delete", key);
    }

    private async Task DeleteApiCacheValueAsync(string key, CancellationToken cancellationToken)
    {
        var endpoint = CreateKvEndpoint(ReadOptions().ApiCacheNamespaceId, key);
        if (endpoint is null)
        {
            return;
        }

        var response = await SendAsync(() => httpClient.DeleteAsync(endpoint, cancellationToken), cancellationToken);
        LogIfUnsuccessful(response, "delete", key);
    }

    private async Task<HttpResponseMessage?> SendAsync(
        Func<Task<HttpResponseMessage>> send,
        CancellationToken cancellationToken)
    {
        try
        {
            return await send();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cloudflare KV cache sync failed.");
            return null;
        }
    }

    private void LogIfUnsuccessful(HttpResponseMessage? response, string operation, string key)
    {
        if (response is null || response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.NotFound)
        {
            return;
        }

        logger.LogWarning(
            "Cloudflare KV {Operation} for {Key} returned {StatusCode}.",
            operation,
            key,
            (int)response.StatusCode);
    }

    private Uri? CreateKvEndpoint(string? namespaceId, string key, int? expirationTtlSeconds = null)
    {
        var options = ReadOptions();
        if (!options.IsConfigured || string.IsNullOrWhiteSpace(namespaceId))
        {
            return null;
        }

        var escapedKey = Uri.EscapeDataString(key);
        var path = $"accounts/{options.AccountId}/storage/kv/namespaces/{namespaceId}/values/{escapedKey}";
        if (expirationTtlSeconds.HasValue)
        {
            path = $"{path}?expiration_ttl={expirationTtlSeconds.Value}";
        }

        return new Uri(path, UriKind.Relative);
    }

    private CloudflareKvOptions ReadOptions()
        => new(
            configuration["Cloudflare:AccountId"],
            configuration["Cloudflare:AuthzNamespaceId"],
            configuration["Cloudflare:ApiCacheNamespaceId"],
            configuration["Cloudflare:ApiToken"]);

    private static string CreateApiCacheKey(string path)
    {
        var match = GroupScopedApiPathRegex.Match(path);
        if (match.Success)
        {
            var cacheKind = match.Groups["kind"].Value switch
            {
                "memberships" or "members" => "members",
                _ => match.Groups["kind"].Value
            };

            return $"group:{match.Groups["groupId"].Value}:{cacheKind}";
        }

        return $"api:{path}";
    }

    private sealed record CloudflareKvOptions(
        string? AccountId,
        string? AuthzNamespaceId,
        string? ApiCacheNamespaceId,
        string? ApiToken)
    {
        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(AccountId) &&
            !string.IsNullOrWhiteSpace(ApiToken);
    }
}
