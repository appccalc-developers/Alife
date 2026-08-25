using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventPreparationTaskMemberDto(Guid MemberId, string DisplayName);

public sealed record EventPreparationTaskDto(
    Guid Id,
    string ModuleKey,
    WorkflowTextDto Title,
    WorkflowTextDto Description,
    Guid? AssignedMemberId,
    string? AssignedDisplayName,
    DateTime? DueUtc,
    bool IsRequired,
    EventPreparationTaskStatus Status,
    IReadOnlyList<Guid> DependencyTaskIds,
    bool IsBlocked,
    DateTime UpdatedUtc);

public sealed record EventPreparationTaskWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    WorkflowTextDto EventTitle,
    DateTime EventStartUtc,
    IReadOnlyList<string> ModuleKeys,
    IReadOnlyList<EventPreparationTaskMemberDto> Members,
    IReadOnlyList<EventPreparationTaskDto> Tasks);
