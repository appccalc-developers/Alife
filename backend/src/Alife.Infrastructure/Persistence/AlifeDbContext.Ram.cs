using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public partial class AlifeDbContext
{
    public DbSet<EventRamPolicyVersion> EventRamPolicyVersions => Set<EventRamPolicyVersion>();
    public DbSet<EventRamRevision> EventRamRevisions => Set<EventRamRevision>();
    public DbSet<EventRamAction> EventRamActions => Set<EventRamAction>();

    private static void ConfigureRamGovernance(ModelBuilder model)
    {
        model.Entity<EventRamAssessment>(b =>
        {
            b.Property(x => x.SchemaVersion).HasDefaultValue(1);
            b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.Property(x => x.Validity).HasMaxLength(32).HasDefaultValue("Legacy");
            b.Property(x => x.ResidualLevel).HasMaxLength(16).HasDefaultValue("Incomplete");
        });
        model.Entity<EventRamPolicyVersion>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.ChurchId, x.Version }).IsUnique();
            b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.HasOne<Group>().WithMany().HasForeignKey(x => x.ChurchId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<EventRamRevision>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.EventId, x.Version }).IsUnique();
            b.Property(x => x.ContentHash).HasMaxLength(64);
            b.Property(x => x.ResidualLevel).HasMaxLength(16);
            b.HasOne<GroupEvent>().WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne<EventRamPolicyVersion>().WithMany().HasForeignKey(x => x.PolicyVersionId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<EventRamAction>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.EventId, x.ActorMemberId, x.IdempotencyKey }).IsUnique();
            b.Property(x => x.IdempotencyKey).HasMaxLength(120);
            b.Property(x => x.RequestHash).HasMaxLength(64);
            b.Property(x => x.Action).HasMaxLength(32);
            b.HasOne<EventRamRevision>().WithMany().HasForeignKey(x => x.RevisionId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
