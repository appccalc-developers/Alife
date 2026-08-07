namespace Alife.Domain.Entities;

public class EventWorkflowTemplate
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public int Version { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public string DefinitionJson { get; set; } = "{}";
    public bool IsActive { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public ICollection<EventWorkflowRun> Runs { get; set; } = [];
}
