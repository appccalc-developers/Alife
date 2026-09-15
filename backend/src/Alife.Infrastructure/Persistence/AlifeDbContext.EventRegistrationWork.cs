using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;
namespace Alife.Infrastructure.Persistence;
public partial class AlifeDbContext
{
    public DbSet<EventRegistrationPolicy> EventRegistrationPolicies => Set<EventRegistrationPolicy>();
    public DbSet<EventRegistrationApplication> EventRegistrationApplications => Set<EventRegistrationApplication>();
    public DbSet<EventRegistrationParticipant> EventRegistrationParticipants => Set<EventRegistrationParticipant>();
    public DbSet<EventRegistrationAction> EventRegistrationActions => Set<EventRegistrationAction>();
    public DbSet<EventRegistrationMaterial> EventRegistrationMaterials => Set<EventRegistrationMaterial>();
    private static void ConfigureEventRegistrationWork(ModelBuilder model)
    {
        model.Entity<EventRegistrationPolicy>(b =>
        {
            b.HasKey(x => x.EventId); b.Property(x => x.ConcurrencyToken).IsConcurrencyToken(); b.Property(x => x.FeeApprovalStatus).HasMaxLength(24);
            b.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Event.IsDeleted);
        });
        model.Entity<EventRegistrationApplication>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.ConcurrencyToken).IsConcurrencyToken(); b.Property(x => x.Channel).HasMaxLength(16); b.Property(x => x.InvitationMode).HasMaxLength(24);
            b.Property(x => x.ManualOrganiserName).HasMaxLength(200); b.Property(x => x.ProxyAuthorityEvidence).HasMaxLength(2000);
            b.HasIndex(x => new { x.EventId, x.QueuedUtc }); b.HasIndex(x => x.LegacyEnrollmentId).IsUnique().HasFilter("[legacy_enrollment_id] IS NOT NULL");
            b.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Event.IsDeleted);
        });
        model.Entity<EventRegistrationParticipant>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.DisplayName).HasMaxLength(200); b.Property(x => x.GuardianName).HasMaxLength(200);
            b.Property(x => x.SeatStatus).HasMaxLength(24); b.Property(x => x.ProcedureStatus).HasMaxLength(24); b.Property(x => x.ConsentMethod).HasMaxLength(32); b.Property(x => x.ConsentEvidence).HasMaxLength(2000);
            b.HasOne(x => x.Application).WithMany(x => x.Participants).HasForeignKey(x => x.ApplicationId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Application.Event.IsDeleted);
        });
        model.Entity<EventRegistrationAction>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Operation).HasMaxLength(40); b.Property(x => x.Evidence).HasMaxLength(2000); b.HasIndex(x => new { x.EventId, x.CreatedUtc });
            b.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Event.IsDeleted);
        });
        model.Entity<EventRegistrationMaterial>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.RequirementId).HasMaxLength(80); b.HasIndex(x => new { x.ParticipantId, x.FileAssetId }).IsUnique();
            b.HasOne(x => x.Participant).WithMany().HasForeignKey(x => x.ParticipantId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.FileAsset).WithMany().HasForeignKey(x => x.FileAssetId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Participant.Application.Event.IsDeleted);
        });
    }
}
