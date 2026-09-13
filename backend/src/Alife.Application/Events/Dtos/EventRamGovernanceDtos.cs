using System.Text.Json;
using System.Text.Json.Serialization;

namespace Alife.Application.Events.Dtos;

public sealed record RamText(string En = "", string Zh = "");
public sealed record RamScale(int Value, RamText Label, RamText Description);
public sealed record RamCell(int Likelihood, int Impact, string? Level);
public sealed record RamCategory(string Code, RamText Name, RamText Guidance);
public sealed record RamQuestion(string Code, string ActivityType, string CategoryCode, RamText Text, RamText Guidance);
public sealed record RamReviewRules(int ReviewReminderDays = 7);
public sealed record RamPolicyData(RamScale[] Likelihood, RamScale[] Impact, RamCell[] Matrix,
    RamCategory[] Categories, RamQuestion[] Questions, RamReviewRules ReviewRules, string Source);
public sealed record RamPolicyDto(Guid? Id, Guid ChurchId, int Version, bool IsPublished, string ETag,
    RamPolicyData Data, Guid? PublishedByMemberId = null, DateTime? PublishedUtc = null);
public sealed record RamPolicySaveRequest(RamPolicyData Data, Guid? DraftId, string? ExpectedETag);
public sealed record RamPolicyPublishRequest(string ExpectedETag, bool ConfirmEveryCell);
public sealed class RamActivity
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "generic";
    public RamText Name { get; set; } = new();
}
public sealed class RamRisk
{
    public string Id { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public string CategoryCode { get; set; } = "";
    public RamText Hazard { get; set; } = new();
    public RamText Consequence { get; set; } = new();
    // Existing likelihood / impact fields mean INITIAL assessment only.
    public int? Likelihood { get; set; }
    public int? Impact { get; set; }
    public int? RiskScore { get; set; }
    public string InitialLevel { get; set; } = "Incomplete";
    public RamText ControlMeasures { get; set; } = new();
    public string PersonResponsible { get; set; } = "";
    public int? ResidualLikelihood { get; set; }
    public int? ResidualImpact { get; set; }
    public int? ResidualScore { get; set; }
    public string ResidualLevel { get; set; } = "Incomplete";
    public RamText AdditionalAction { get; set; } = new();
}
public sealed record RamAnswer(string ActivityId, string QuestionCode, RamText Answer, bool NotApplicable = false, RamText? Reason = null);
public sealed class RamV2Draft
{
    public int SchemaVersion { get; set; } = 2;
    public RamActivity[] Activities { get; set; } = [];
    public RamRisk[] Hazards { get; set; } = [];
    public RamAnswer[] Answers { get; set; } = [];
    public bool? AuthorAttendsAndLeads { get; set; }
    public Guid? OnsiteMemberId { get; set; }
    public bool IsOuting { get; set; }
    public bool IsOvernight { get; set; }
    public bool IsHighRisk { get; set; }
    public int? ParticipantCount { get; set; }
    public RamText WeatherConfirmation { get; set; } = new();
    public RamText Accommodation { get; set; } = new();
    public RamText Transport { get; set; } = new();
    [JsonExtensionData] public Dictionary<string, JsonElement>? LegacyFields { get; set; }
}
public sealed record RamEvaluation(RamV2Draft Draft, string ResidualLevel, IReadOnlyList<string> Errors);
public sealed record RamSaveRequest(string RamDataJson, Guid? PolicyVersionId, string ExpectedETag);
public sealed record RamActionRequest(Guid? RevisionId, string ExpectedETag, string Reason = "", bool HealthSafetySigned = false);
public sealed record RamPerson(Guid MemberId, string Name);
public sealed record RamRevisionDto(Guid Id, int Version, int SchemaVersion, Guid? PolicyVersionId,
    string ContentHash, string ResidualLevel, Guid AuthorMemberId, Guid? OnsiteMemberId, DateTime CreatedUtc);
public sealed record RamActionDto(Guid Id, Guid RevisionId, Guid ActorMemberId, string Action, string Reason,
    bool HealthSafetySigned, DateTime CreatedUtc);
public sealed record RamEventPlanContextDto(Guid EventId, Guid GroupId, RamText Title, DateTime StartUtc,
    DateTime EndUtc, EventPlanSnapshotDto? AcceptedPlan);
public sealed record RamWorkspaceDto(EventRamAssessmentDto? Assessment, RamPolicyDto? Policy,
    IReadOnlyList<RamRevisionDto> History, IReadOnlyList<RamActionDto> Actions, IReadOnlyList<RamPerson> OnsiteCandidates,
    bool CanEdit, bool CanAudit, Guid CurrentMemberId, bool IsRequired, RamPolicyDto? LatestPolicy = null,
    RamEventPlanContextDto? EventPlanContext = null);
public sealed record RamPrintDto(RamRevisionDto Revision, string RamDataJson, RamPolicyDto? Policy,
    IReadOnlyList<RamActionDto> Actions, bool IsCurrent, string Validity, bool IsDraft);
