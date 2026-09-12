namespace Alife.Domain.Entities;

/// <summary>Church-scoped policy. Published rows are immutable; restoration creates a new version.</summary>
public sealed class EventRamPolicyVersion
{
    public Guid Id { get; set; }
    public Guid ChurchId { get; set; }
    public int Version { get; set; }
    public string PolicyJson { get; set; } = "{}";
    public bool IsPublished { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public Guid? PublishedByMemberId { get; set; }
    public DateTime? PublishedUtc { get; set; }
}

/// <summary>Immutable assessment content, including legacy approval evidence during upgrade.</summary>
public sealed class EventRamRevision
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public int Version { get; set; }
    public int SchemaVersion { get; set; }
    public Guid? PolicyVersionId { get; set; }
    public string RamDataJson { get; set; } = "{}";
    public string ContentHash { get; set; } = "";
    public string ResidualLevel { get; set; } = "Incomplete";
    public Guid AuthorMemberId { get; set; }
    public Guid? OnsiteMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
}

/// <summary>Append-only confirmations and decisions. A receipt binds its key to actor and request.</summary>
public sealed class EventRamAction
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid RevisionId { get; set; }
    public Guid ActorMemberId { get; set; }
    public string Action { get; set; } = "";
    public string Reason { get; set; } = "";
    public string IdempotencyKey { get; set; } = "";
    public string RequestHash { get; set; } = "";
    public bool HealthSafetySigned { get; set; }
    public DateTime CreatedUtc { get; set; }
}
