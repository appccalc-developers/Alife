namespace Alife.Application.Admin.Dtos;

public sealed record AuditLogDto(
    Guid Id,
    Guid? ActorMemberId,
    string? ActorDisplayName,
    string Action,
    string EntityType,
    Guid? EntityId,
    Guid? GroupId,
    Guid? EventId,
    Guid? TargetMemberId,
    string? TargetDisplayName,
    string? BeforeJson,
    string? AfterJson,
    string? MetadataJson,
    DateTime OccurredUtc);
