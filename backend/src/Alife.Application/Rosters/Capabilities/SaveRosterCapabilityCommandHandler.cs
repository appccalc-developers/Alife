using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Capabilities;

public sealed class SaveRosterCapabilityCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveRosterCapabilityCommand, AppResult<RosterCapabilityDto>>
{
    public async Task<AppResult<RosterCapabilityDto>> Handle(
        SaveRosterCapabilityCommand request, CancellationToken cancellationToken)
    {
        if (!await authorization.IsLeaderOrCoLeaderAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<RosterCapabilityDto>.Forbidden("Only group leaders can maintain roster capabilities.");
        var key = RosterPolicy.NormalizeKey(request.Key);
        if (key.Length is < 2 or > 80)
            return AppResult<RosterCapabilityDto>.Validation("A capability key must contain 2 to 80 letters, numbers, dashes or underscores.");
        if (string.IsNullOrWhiteSpace(request.NameEn) && string.IsNullOrWhiteSpace(request.NameZh))
            return AppResult<RosterCapabilityDto>.Validation("An English or Chinese capability name is required.");
        if (request.RequiresExpiry && request.DefaultValidityDays is not (>= 1 and <= 3650))
            return AppResult<RosterCapabilityDto>.Validation("An expiring capability needs a default validity from 1 to 3650 days.");

        var nowUtc = DateTime.UtcNow;
        GroupRosterCapability capability;
        var created = !request.CapabilityId.HasValue;
        if (request.CapabilityId.HasValue)
        {
            capability = await db.GroupRosterCapabilities.FirstOrDefaultAsync(
                x => x.Id == request.CapabilityId.Value && x.GroupId == request.GroupId, cancellationToken) ?? null!;
            if (capability is null) return AppResult<RosterCapabilityDto>.NotFound("Roster capability not found.");
            if (!string.Equals(capability.Key, key, StringComparison.Ordinal))
                return AppResult<RosterCapabilityDto>.Validation("The capability key cannot be changed after it is created.");
        }
        else
        {
            if (await db.GroupRosterCapabilities.AnyAsync(x => x.GroupId == request.GroupId && x.Key == key, cancellationToken))
                return AppResult<RosterCapabilityDto>.Conflict("This group already has a capability with the same key.");
            capability = new GroupRosterCapability
            {
                Id = Guid.NewGuid(), GroupId = request.GroupId, Key = key,
                CreatedByMemberId = request.CurrentMemberId, CreatedUtc = nowUtc
            };
            db.GroupRosterCapabilities.Add(capability);
        }

        capability.NameEn = Fallback(request.NameEn, request.NameZh);
        capability.NameZh = Fallback(request.NameZh, request.NameEn);
        capability.DescriptionEn = RosterPolicy.Truncate(request.DescriptionEn, 1000);
        capability.DescriptionZh = RosterPolicy.Truncate(request.DescriptionZh, 1000);
        capability.RequiresExpiry = request.RequiresExpiry;
        capability.DefaultValidityDays = request.RequiresExpiry ? request.DefaultValidityDays : null;
        capability.IsActive = request.IsActive;
        capability.UpdatedByMemberId = request.CurrentMemberId;
        capability.UpdatedUtc = nowUtc;

        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, GroupId = request.GroupId,
            Action = created ? "roster.capability.created" : "roster.capability.updated",
            EntityType = nameof(GroupRosterCapability), EntityId = capability.Id,
            AfterJson = JsonSerializer.Serialize(new
            {
                capability.Key, capability.NameEn, capability.NameZh, capability.RequiresExpiry,
                capability.DefaultValidityDays, capability.IsActive
            }),
            OccurredUtc = nowUtc
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<RosterCapabilityDto>.Success(new RosterCapabilityDto(
            capability.Id, capability.GroupId, capability.Key,
            new WorkflowTextDto(capability.NameEn, capability.NameZh),
            new WorkflowTextDto(capability.DescriptionEn, capability.DescriptionZh),
            capability.RequiresExpiry, capability.DefaultValidityDays, capability.IsActive, capability.UpdatedUtc));
    }

    private static string Fallback(string primary, string secondary) =>
        string.IsNullOrWhiteSpace(primary) ? secondary.Trim() : primary.Trim();
}
