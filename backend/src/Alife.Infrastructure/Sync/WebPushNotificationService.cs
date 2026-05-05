using System.Text.Json;
using Alife.Application.Common.Sync;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebPush;

namespace Alife.Infrastructure.Sync;

public sealed class WebPushNotificationService(
    IConfiguration configuration,
    IPushSubscriptionStore subscriptionStore,
    ILogger<WebPushNotificationService> logger)
{
    private readonly string _subject = configuration["Push:Subject"] ?? "mailto:admin@example.com";
    private readonly string _publicKey = configuration["Push:VapidPublicKey"] ?? "";
    private readonly string _privateKey = configuration["Push:VapidPrivateKey"] ?? "";

    public string? PublicKey => string.IsNullOrWhiteSpace(_publicKey) ? null : _publicKey;

    public async Task SendSilentUpdateAsync(
        SyncEntityChange change,
        long version,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_publicKey) || string.IsNullOrWhiteSpace(_privateKey))
        {
            logger.LogDebug("VAPID keys are not configured; skipped push dispatch for {EntityType}:{EntityId}.", change.EntityType, change.EntityId);
            return;
        }

        var subscriptions = await subscriptionStore.GetForMembersAsync(change.RecipientMemberIds, cancellationToken);
        if (subscriptions.Count == 0)
        {
            return;
        }

        var payload = JsonSerializer.Serialize(new
        {
            type = "ENTITY_UPDATED",
            entityType = change.EntityType,
            entityId = change.EntityId,
            apiPath = change.ApiPath,
            versionKeys = change.VersionKeys,
            version
        });

        var vapid = new VapidDetails(_subject, _publicKey, _privateKey);
        using var client = new WebPushClient();

        foreach (var item in subscriptions)
        {
            var subscription = new PushSubscription(
                item.Subscription.Endpoint,
                item.Subscription.P256dh,
                item.Subscription.Auth);

            try
            {
                await client.SendNotificationAsync(subscription, payload, vapid, cancellationToken);
            }
            catch (WebPushException ex) when ((int?)ex.StatusCode is 404 or 410)
            {
                await subscriptionStore.DeleteAsync(item.MemberId, item.Subscription.Endpoint, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send sync push to member {MemberId}.", item.MemberId);
            }
        }
    }
}

