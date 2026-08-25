namespace Alife.Application.Events.Dtos;

/// <summary>Represents a bilingual, AI-extractable event.</summary>
public record EventDto
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string OrganizerId { get; init; } = string.Empty;

    // --- Bilingual Content ---
    public MultilingualString Title { get; init; } = new();
    public MultilingualString Description { get; init; } = new();
    public MultilingualString LocationName { get; init; } = new();

    // --- Scheduling & Capacity ---
    public DateTime StartDate { get; init; }
    public DateTime EndDate { get; init; }
    public DateTime RegistrationDeadline { get; init; }

    public int MaxCapacity { get; init; }
    public string CapacityUnit { get; init; } = "Families";

    // --- Rules & AI Constraints ---
    public List<EventRuleDto> HardConstraints { get; init; } = [];
    public List<OptionalActivityDto> OptionalActivities { get; init; } = [];
    public bool RequiresRoster { get; init; }

    // --- Financials ---
    public decimal? BaseFeePerAdult { get; init; }
    public decimal? BaseFeePerChild { get; init; }
    public string Currency { get; init; } = "NZD";
    public MultilingualString PaymentInstructions { get; init; } = new();
    public MultilingualString RefundPolicy { get; init; } = new();
    public bool PaymentEvidenceRequired { get; init; }
    public bool FinanceLeaderConfirmed { get; init; }

    // --- Media & Legacy ---
    public string? PosterImageUrl { get; init; }
    public List<string> GalleryUrls { get; init; } = [];
    public MultilingualString? LegacySummary { get; init; }
}

/// <summary>Bilingual string ensuring semantic parity between Chinese and English.</summary>
public record MultilingualString
{
    public string Zh { get; init; } = string.Empty;
    public string En { get; init; } = string.Empty;

    public string GetValue(string langCode) =>
        langCode.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? En : Zh;
}

/// <summary>A hard constraint / rule attached to an event.</summary>
public record EventRuleDto
{
    public string RuleKey { get; init; } = "General";
    public MultilingualString DisplayMessage { get; init; } = new();
    public bool IsMandatory { get; init; } = true;
}

/// <summary>An optional, fee-bearing activity within an event.</summary>
public record OptionalActivityDto
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public MultilingualString Name { get; init; } = new();
    public decimal ExtraFee { get; init; }
}
