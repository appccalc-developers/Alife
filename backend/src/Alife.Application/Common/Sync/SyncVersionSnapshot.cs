namespace Alife.Application.Common.Sync;

public sealed record SyncVersionSnapshot(IReadOnlyDictionary<string, long> Versions);

