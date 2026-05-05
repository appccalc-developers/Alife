namespace Alife.Application.Common.Sync;

public sealed record PushSubscriptionDto(
    string Endpoint,
    string P256dh,
    string Auth,
    string? UserAgent);

