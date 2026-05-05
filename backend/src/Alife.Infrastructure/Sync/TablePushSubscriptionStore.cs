using System.Security.Cryptography;
using System.Text;
using Alife.Application.Common.Sync;
using Azure;
using Azure.Data.Tables;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Sync;

public sealed class TablePushSubscriptionStore(
    IConfiguration configuration,
    ILogger<TablePushSubscriptionStore> logger)
    : IPushSubscriptionStore
{
    private const string TableName = "UserSubscriptions";
    private readonly string _connectionString = configuration["Storage:ConnectionString"]
        ?? configuration["AzureWebJobsStorage"]
        ?? "";

    public async Task UpsertAsync(Guid memberId, PushSubscriptionDto subscription, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            logger.LogDebug("Azure Table Storage is not configured; skipped push subscription upsert.");
            return;
        }

        var client = await GetTableClientAsync(cancellationToken);
        var entity = new PushSubscriptionEntity
        {
            PartitionKey = memberId.ToString("N"),
            RowKey = HashEndpoint(subscription.Endpoint),
            Endpoint = subscription.Endpoint,
            P256dh = subscription.P256dh,
            Auth = subscription.Auth,
            UserAgent = subscription.UserAgent,
            UpdatedUtc = DateTimeOffset.UtcNow
        };

        await client.UpsertEntityAsync(entity, TableUpdateMode.Replace, cancellationToken);
    }

    public async Task DeleteAsync(Guid memberId, string endpoint, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return;
        }

        var client = await GetTableClientAsync(cancellationToken);
        await client.DeleteEntityAsync(memberId.ToString("N"), HashEndpoint(endpoint), ETag.All, cancellationToken);
    }

    public async Task<IReadOnlyList<StoredPushSubscription>> GetForMembersAsync(
        IReadOnlyCollection<Guid> memberIds,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured || memberIds.Count == 0)
        {
            return [];
        }

        var client = await GetTableClientAsync(cancellationToken);
        var result = new List<StoredPushSubscription>();

        foreach (var memberId in memberIds.Distinct())
        {
            var partitionKey = memberId.ToString("N");
            await foreach (var entity in client.QueryAsync<PushSubscriptionEntity>(
                               x => x.PartitionKey == partitionKey,
                               cancellationToken: cancellationToken))
            {
                result.Add(new StoredPushSubscription(
                    memberId,
                    new PushSubscriptionDto(entity.Endpoint, entity.P256dh, entity.Auth, entity.UserAgent)));
            }
        }

        return result;
    }

    private bool IsConfigured => !string.IsNullOrWhiteSpace(_connectionString);

    private async Task<TableClient> GetTableClientAsync(CancellationToken cancellationToken)
    {
        var service = new TableServiceClient(_connectionString);
        var client = service.GetTableClient(TableName);
        await client.CreateIfNotExistsAsync(cancellationToken);
        return client;
    }

    private static string HashEndpoint(string endpoint)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(endpoint));
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private sealed class PushSubscriptionEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = "";
        public string RowKey { get; set; } = "";
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }
        public string Endpoint { get; set; } = "";
        public string P256dh { get; set; } = "";
        public string Auth { get; set; } = "";
        public string? UserAgent { get; set; }
        public DateTimeOffset UpdatedUtc { get; set; }
    }
}

