namespace Alife.Domain.Entities;

public sealed class EventFactSet
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public int Version { get; set; }
    public string SchemaVersion { get; set; } = "1.0.0";
    public string FactsJson { get; set; } = "[]";
    public string SourceHash { get; set; } = string.Empty;
    public Guid? CreatedByMemberId { get; set; }
    public bool IsLegacyBackfill { get; set; }
    public DateTime CreatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member? CreatedByMember { get; set; }
    public ICollection<EventPlanSnapshot> PlanSnapshots { get; set; } = [];
}

public sealed class EventPlanSnapshot
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid SourceFactSetId { get; set; }
    public int Version { get; set; }
    public string SchemaVersion { get; set; } = "1.0.0";
    public string ProposalHash { get; set; } = string.Empty;
    public string ETag { get; set; } = string.Empty;
    public string? ArchetypeCode { get; set; }
    public int? ArchetypeVersion { get; set; }
    public string? ActivityTypeCode { get; set; }
    public int? ActivityTypeVersion { get; set; }
    public string SnapshotJson { get; set; } = "{}";
    public Guid? AcceptedByMemberId { get; set; }
    public DateTime? AcceptedUtc { get; set; }
    public bool IsActive { get; set; }
    public bool IsLegacyBackfill { get; set; }
    public DateTime CreatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public EventFactSet SourceFactSet { get; set; } = null!;
    public Member? AcceptedByMember { get; set; }
}

public sealed class EventIdempotencyRecord
{
    public Guid Id { get; set; }
    public string Operation { get; set; } = string.Empty;
    public Guid ScopeId { get; set; }
    public string Key { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public Guid ResultEntityId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
}
