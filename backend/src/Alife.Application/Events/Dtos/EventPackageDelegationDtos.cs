using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventPackageApprovalDelegationDto(
    Guid Id,
    Guid OrganisationId,
    EventPackageDelegationScopeType ScopeType,
    Guid? ScopeId,
    string PermissionCode,
    Guid DelegatedToMemberId,
    DateTime StartsUtc,
    DateTime ExpiresUtc,
    Guid GrantedByMemberId,
    DateTime GrantedUtc,
    Guid? RevokedByMemberId,
    DateTime? RevokedUtc,
    LocalizedTextDto? RevocationReason,
    string ETag);

public sealed record GrantEventPackageApprovalDelegationRequest(
    Guid OrganisationId,
    EventPackageDelegationScopeType ScopeType,
    Guid? ScopeId,
    string PermissionCode,
    Guid DelegatedToMemberId,
    DateTime StartsUtc,
    DateTime ExpiresUtc);

public sealed record RevokeEventPackageApprovalDelegationRequest(LocalizedTextDto Reason);
