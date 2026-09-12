using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventRamAssessmentDto(
    Guid EventId,
    Guid GroupId,
    string RamDataJson,
    EventRamStatus Status,
    Guid? SubmittedByMemberId,
    DateTime? SubmittedUtc,
    Guid? ApprovedByMemberId,
    DateTime? ApprovedUtc,
    DateTime CreatedUtc,
    DateTime UpdatedUtc,
    int SchemaVersion = 1,
    string ETag = "",
    Guid? PolicyVersionId = null,
    Guid? CurrentRevisionId = null,
    string Validity = "Legacy",
    string ResidualLevel = "Incomplete",
    Guid? AuthorMemberId = null,
    bool ReviewRequested = false);
