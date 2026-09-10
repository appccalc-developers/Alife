using System.Linq.Expressions;
using System.Reflection;
using System.Text.Json;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Alife.Infrastructure.Persistence;

public partial class AlifeDbContext
{
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // An audit identity is not a live group, even for writes that bypass a UI
        // lookup. Existing evidence may remain; new business data may not attach.
        var groupIds = ChangeTracker.Entries()
            .Where(e => e.Entity is not AuditLog && e.State is EntityState.Added or EntityState.Modified)
            .SelectMany(e => e.Metadata.GetForeignKeys()
                .Where(fk => fk.PrincipalEntityType.ClrType == typeof(Group))
                .SelectMany(fk => fk.Properties.Select(p => e.Property(p.Name).CurrentValue)))
            .OfType<Guid>().Distinct().ToArray();
        if (groupIds.Length > 0 && await Groups.IgnoreQueryFilters().AnyAsync(g => groupIds.Contains(g.Id) && g.IsDissolved, cancellationToken))
            throw new InvalidOperationException("Cannot attach business data to a dissolved group.");
        return await base.SaveChangesAsync(cancellationToken);
    }

    // Only called after the application has checked the leader and empty-group rules,
    // inside its serializable transaction. Follow dependent records, never principals
    // (in particular, never Member accounts or the events that use a group resource).
    public async Task StageGroupDissolutionAsync(Guid groupId, Guid actorId, CancellationToken ct = default)
    {
        var group = await Groups.SingleAsync(x => x.Id == groupId, ct);
        var visited = new HashSet<object>(ReferenceEqualityComparer.Instance);
        var retainAuditIdentity = false;
        foreach (var link in await Links.Where(x => x.TargetGroupId == groupId).ToListAsync(ct))
            Remove(link);
        // These legacy references are not EF foreign keys.
        foreach (var invitation in await MemberActivationInvitations.Where(x => x.RecoveryGroupId == groupId).ToListAsync(ct))
        {
            invitation.RecoveryGroupId = null;
            invitation.Status = ActivationStatus.Revoked;
            invitation.RevokedUtc = DateTime.UtcNow;
        }
        await RemoveDependents(group, true);

        async Task RemoveDependents(object entity, bool root = false)
        {
            if (!visited.Add(entity)) return;
            var entry = Entry(entity);
            if (!root && (entity is Member || entity is Group || entity is GroupEvent || entity is EventSeries))
                throw new InvalidOperationException("Dissolution cannot delete another group, account or event.");

            // These records are immutable/auditable dependencies of other events.
            // Keep their exact identities and foreign keys instead of rewriting those events.
            if ((entity is EventPackageGovernancePolicyVersion governance && await EventPackages.AnyAsync(x => x.GovernancePolicyVersionId == governance.Id, ct))
                || (entity is EventSafeguardingPolicyVersion safeguarding && await EventSafeguardingConfigurations.AnyAsync(x => x.PolicyVersionId == safeguarding.Id, ct))
                || (entity is EventWorkflowTemplate template && await EventWorkflowRuns.AnyAsync(x => x.TemplateId == template.Id, ct))
                || (entity is EventVenue venue && await EventVenueReservations.AnyAsync(x => x.VenueId == venue.Id, ct))
                || (entity is EventEnrollment enrollment && await EventChildRegistrations.AnyAsync(x => x.EnrollmentId == enrollment.Id, ct)))
            {
                retainAuditIdentity = true;
                if (entity is EventVenue retainedVenue) retainedVenue.IsActive = false;
                if (entity is EventWorkflowTemplate retainedTemplate) retainedTemplate.IsActive = false;
                return;
            }

            if (entity is FileAsset sharedFile)
            {
                // Attachments referenced by surviving content are shared data, not
                // exclusively owned by the dissolved group. Preserve those objects.
                foreach (var reference in entry.Metadata.GetReferencingForeignKeys())
                {
                    if (reference.DeclaringEntityType.ClrType == typeof(AuditLog)) continue;
                    var key = reference.PrincipalKey.Properties.Select(p => entry.Property(p.Name).CurrentValue).ToArray();
                    if ((await LoadDissolutionDependents(reference, key, ct)).Count == 0) continue;
                    sharedFile.GroupId = null;
                    return;
                }
            }

            // Audit rows survive; their entity identity remains even when the FK is detached.
            foreach (var fk in entry.Metadata.GetReferencingForeignKeys())
            {
                var values = fk.PrincipalKey.Properties.Select(p => entry.Property(p.Name).CurrentValue).ToArray();
                foreach (var dependent in await LoadDissolutionDependents(fk, values, ct))
                {
                    var dependentEntry = Entry(dependent);
                    if (dependent is AuditLog || (!root && fk.Properties.All(p => p.IsNullable)))
                    {
                        foreach (var property in fk.Properties) dependentEntry.Property(property.Name).CurrentValue = null;
                        continue;
                    }
                    await RemoveDependents(dependent);
                    // Break nullable cycles among deleted records before EF orders commands.
                    if (dependentEntry.State == EntityState.Deleted)
                        foreach (var property in fk.Properties.Where(p => p.IsNullable))
                            dependentEntry.Property(property.Name).CurrentValue = null;
                }
            }

            if (entity is GroupJoinInvite invite)
                OnboardingFlows.RemoveRange(await OnboardingFlows.Where(x => x.GroupJoinInviteId == invite.Id).ToListAsync(ct));
            if (entity is ApplicationResponseToken token)
                OnboardingFlows.RemoveRange(await OnboardingFlows.Where(x => x.ApplicationResponseTokenId == token.Id).ToListAsync(ct));

            // Decision histories are audit evidence, even when their operational record is removed.
            if (entity is Alife.Domain.Entities.ApplicationHistory or EventPackageDecision or EventSafeguardingPolicyVersion
                or EventPackageGovernancePolicyVersion or EventPackageApprovalDelegation)
                AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(), ActorMemberId = actorId, Action = "group.dissolution.evidence-retained",
                    EntityType = entry.Metadata.ClrType.Name,
                    EntityId = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "Id")?.CurrentValue as Guid?,
                    BeforeJson = JsonSerializer.Serialize(entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.CurrentValue)),
                    MetadataJson = JsonSerializer.Serialize(new { dissolvedGroupId = groupId }),
                    OccurredUtc = DateTime.UtcNow
                });

            if (entity is FileAsset file)
            {
                // Durable object-deletion queue using the existing deleted-file lifecycle.
                // Metadata is removed only after the storage provider confirms exact-key deletion.
                file.GroupId = null;
                file.IsDeleted = true;
                file.DeletedUtc = DateTime.UtcNow;
                file.RelatedEntityType = "DissolvedGroup";
                file.RelatedEntityId = groupId;
                file.PublicUrl = null;
            }
            else if (root && retainAuditIdentity)
            {
                // A hidden identity exists only for retained audit foreign keys.
                // The query filter prevents reopening it through ordinary group APIs.
                group.IsDissolved = true;
                group.IsClosed = true;
                group.ParentGroupId = null;
                group.DescriptionJson = null;
                group.UpdatedUtc = DateTime.UtcNow;
            }
            else Remove(entity);
        }
    }

    private Task<List<object>> LoadDissolutionDependents(IForeignKey fk, object?[] values, CancellationToken ct)
        => (Task<List<object>>)typeof(AlifeDbContext)
            .GetMethod(nameof(LoadDissolutionDependentsTyped), BindingFlags.Instance | BindingFlags.NonPublic)!
            .MakeGenericMethod(fk.DeclaringEntityType.ClrType).Invoke(this, [fk, values, ct])!;

    private async Task<List<object>> LoadDissolutionDependentsTyped<T>(IForeignKey fk, object?[] values, CancellationToken ct) where T : class
    {
        var parameter = Expression.Parameter(typeof(T), "row");
        Expression? predicate = null;
        for (var i = 0; i < fk.Properties.Count; i++)
        {
            var property = fk.Properties[i];
            var read = Expression.Call(typeof(EF), nameof(EF.Property), [property.ClrType], parameter, Expression.Constant(property.Name));
            var equal = Expression.Equal(read, Expression.Convert(Expression.Constant(values[i]), property.ClrType));
            predicate = predicate is null ? equal : Expression.AndAlso(predicate, equal);
        }
        var rows = await Set<T>().IgnoreQueryFilters().Where(Expression.Lambda<Func<T, bool>>(predicate!, parameter)).ToListAsync(ct);
        return rows.Cast<object>().ToList();
    }
}
