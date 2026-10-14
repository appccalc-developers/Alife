namespace Alife.Domain.Entities;

public sealed class EventActivityPlan
{
    public Guid EventId { get; set; }
    public int QuestionnaireVersion { get; set; } = 2;
    public int? ParticipantCount { get; set; }
    public bool IsOuting { get; set; }
    public bool IsOvernight { get; set; }
    public bool IsHighRisk { get; set; }
    public string? WeatherConfirmationEn { get; set; }
    public string? WeatherConfirmationZh { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime UpdatedUtc { get; set; }
    public GroupEvent Event { get; set; } = null!;
    public ICollection<EventActivityProject> Projects { get; set; } = [];
}

public sealed class EventActivityProject
{
    public Guid EventId { get; set; }
    public string ActivityId { get; set; } = "";
    public int SortOrder { get; set; }
    public string NameEn { get; set; } = "";
    public string NameZh { get; set; } = "";
    public string ConditionsEn { get; set; } = "";
    public string ConditionsZh { get; set; } = "";
    public Guid? OccurrenceId { get; set; }
    public string? SourcePresetKey { get; set; }
    public int? SourceTemplateVersion { get; set; }
    public DateTime? StartUtc { get; set; }
    public DateTime? EndUtc { get; set; }
    public bool PresetConfirmed { get; set; }
    public bool RepeatForEachOccurrence { get; set; }
    public EventActivityPlan Plan { get; set; } = null!;
    public ICollection<EventActivityProjectAttribute> Attributes { get; set; } = [];
    public ICollection<EventActivityProjectAnswer> Answers { get; set; } = [];
    public EventActivityProjectDefaults? Defaults { get; set; }
}

public sealed class EventActivityProjectAttribute
{
    public Guid EventId { get; set; }
    public string ActivityId { get; set; } = "";
    public string AttributeCode { get; set; } = "";
    public EventActivityProject Project { get; set; } = null!;
}

public sealed class EventActivityProjectAnswer
{
    public Guid EventId { get; set; }
    public string ActivityId { get; set; } = "";
    public string QuestionCode { get; set; } = "";
    public string Value { get; set; } = "";
    public string Source { get; set; } = "";
    public bool Confirmed { get; set; }
    public EventActivityProject Project { get; set; } = null!;
}

public sealed class EventActivityProjectDefaults
{
    public Guid EventId { get; set; }
    public string ActivityId { get; set; } = "";
    public string? EligibilityEn { get; set; }
    public string? EligibilityZh { get; set; }
    public int? MinimumAge { get; set; }
    public int? MaximumAge { get; set; }
    public int? Capacity { get; set; }
    public bool? AllowWaitlist { get; set; }
    public bool? RequiresGuardianConsent { get; set; }
    public long? FeeMinor { get; set; }
    public string? Currency { get; set; }
    public string? FeeChargeScope { get; set; }
    public string? TermsEn { get; set; }
    public string? TermsZh { get; set; }
    public EventActivityProject Project { get; set; } = null!;
}
