namespace Alife.Domain.Entities;

public class EventActivityTemplateVersion
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public int Version { get; set; }
    public string ArchetypeCode { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public string IconKey { get; set; } = string.Empty;
    public string Visibility { get; set; } = string.Empty;
    public string RegistrationMode { get; set; } = string.Empty;
    public string PreselectedModulesJson { get; set; } = "[]";
    public string? RecommendedWorkflowTemplateCode { get; set; }
    public string PresetServiceSlotsJson { get; set; } = "[]";
    public bool IsActive { get; set; }
    public bool IsCurrent { get; set; }
    public bool IsSystemPreset { get; set; }
    public Guid? CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime? SupersededUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public Member? CreatedByMember { get; set; }
}
