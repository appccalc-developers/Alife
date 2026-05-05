namespace Alife.Application.Common.Sync;

public sealed record SyncEntityChange(
    string EntityType,
    string EntityId,
    string? ApiPath,
    IReadOnlyCollection<string> VersionKeys,
    IReadOnlyCollection<Guid> RecipientMemberIds);

