namespace Alife.Domain.Entities;

/// <summary>A module author's working copy. Submitted revisions are immutable.</summary>
public sealed class EventModuleReport
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string ModuleCode { get; set; } = string.Empty;
    public string DraftEn { get; set; } = string.Empty;
    public string DraftZh { get; set; } = string.Empty;
    public string Status { get; set; } = "draft";
    public int Revision { get; set; }
    public Guid? SubmittedRevisionId { get; set; }
    public Guid? AdoptedRevisionId { get; set; }
    public Guid UpdatedByMemberId { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public GroupEvent Event { get; set; } = null!;
}

public sealed class EventModuleReportRevision
{
    public Guid Id { get; set; }
    public Guid ReportId { get; set; }
    public int Version { get; set; }
    public string TextEn { get; set; } = string.Empty;
    public string TextZh { get; set; } = string.Empty;
    public Guid AuthorMemberId { get; set; }
    public int? EventPlanVersion { get; set; }
    public DateTime SubmittedUtc { get; set; }
    public EventModuleReport Report { get; set; } = null!;
}

public sealed class EventModuleReportAction
{
    public Guid Id { get; set; }
    public Guid ReportId { get; set; }
    public Guid? RevisionId { get; set; }
    public Guid ActorMemberId { get; set; }
    public string Operation { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; }
    public EventModuleReport Report { get; set; } = null!;
}
