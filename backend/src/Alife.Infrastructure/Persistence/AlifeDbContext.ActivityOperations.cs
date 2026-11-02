using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public partial class AlifeDbContext
{
    public DbSet<EventActivityPolicyVersion> EventActivityPolicyVersions => Set<EventActivityPolicyVersion>();
    public DbSet<EventActivityOffer> EventActivityOffers => Set<EventActivityOffer>();
    public DbSet<EventActivityParticipation> EventActivityParticipations => Set<EventActivityParticipation>();
    public DbSet<EventParticipantPrivateData> EventParticipantPrivateData => Set<EventParticipantPrivateData>();
    public DbSet<EventActivityConsent> EventActivityConsents => Set<EventActivityConsent>();
    public DbSet<EventActivityPayment> EventActivityPayments => Set<EventActivityPayment>();
    public DbSet<EventActivitySpaceRequest> EventActivitySpaceRequests => Set<EventActivitySpaceRequest>();

    private static void ConfigureActivityOperations(ModelBuilder model)
    {
        model.Entity<EventActivityPolicyVersion>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.ActivityId).HasMaxLength(80); b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.Property(x => x.FeeApprovalStatus).HasMaxLength(24);
            b.HasIndex(x => new { x.EventId, x.ActivityId, x.Version }).IsUnique();
            b.HasIndex(x => new { x.EventId, x.ActivityId, x.IsCurrent }).IsUnique().HasFilter("[is_current] = 1");
            b.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Event.IsDeleted);
            b.HasOne<EventActivityProject>().WithMany().HasForeignKey(x => new { x.EventId, x.ActivityId }).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<EventActivityOffer>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.ActivityId).HasMaxLength(80); b.Property(x => x.Status).HasMaxLength(24); b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.HasIndex(x => new { x.EventId, x.ActivityId, x.OccurrenceId }).IsUnique();
            b.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<EventActivityProject>().WithMany().HasForeignKey(x => new { x.EventId, x.ActivityId }).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Occurrence).WithMany().HasForeignKey(x => x.OccurrenceId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyVersionId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Event.IsDeleted);
        });
        model.Entity<EventActivityParticipation>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Currency).HasMaxLength(3); b.Property(x => x.SeatStatus).HasMaxLength(24);
            b.Property(x => x.ProcedureStatus).HasMaxLength(32); b.Property(x => x.Eligibility).HasMaxLength(24); b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.HasIndex(x => new { x.OfferId, x.ParticipantId }).IsUnique().HasFilter("[seat_status] <> N'cancelled' AND [seat_status] <> N'expired'"); b.HasIndex(x => new { x.OfferId, x.QueuedUtc });
            b.HasOne(x => x.Offer).WithMany().HasForeignKey(x => x.OfferId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Participant).WithMany().HasForeignKey(x => x.ParticipantId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<EventActivityPolicyVersion>().WithMany().HasForeignKey(x => x.PolicyVersionId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<EventActivityParticipation>().WithMany().HasForeignKey(x => x.ChargeParticipationId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<EventActivityPolicyVersion>().WithMany().HasForeignKey(x => x.FeePolicyVersionId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Offer.Event.IsDeleted);
        });
        model.Entity<EventParticipantPrivateData>(b =>
        {
            b.HasKey(x => x.ParticipantId); b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.HasOne(x => x.Participant).WithOne().HasForeignKey<EventParticipantPrivateData>(x => x.ParticipantId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Participant.Application.Event.IsDeleted);
        });
        model.Entity<EventActivityConsent>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Method).HasMaxLength(32); b.Property(x => x.Evidence).HasMaxLength(2000);
            b.HasOne(x => x.Participation).WithMany().HasForeignKey(x => x.ParticipationId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Participation.Offer.Event.IsDeleted);
        });
        model.Entity<EventActivityPayment>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Operation).HasMaxLength(16); b.Property(x => x.Evidence).HasMaxLength(2000);
            b.HasOne(x => x.Participation).WithMany().HasForeignKey(x => x.ParticipationId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Participation.Offer.Event.IsDeleted);
        });
        model.Entity<EventActivitySpaceRequest>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Kind).HasMaxLength(16); b.Property(x => x.Status).HasMaxLength(24); b.Property(x => x.Evidence).HasMaxLength(2000);
            b.Property(x => x.NameEn).HasMaxLength(300); b.Property(x => x.NameZh).HasMaxLength(300); b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.HasIndex(x => x.OfferId).IsUnique();
            b.HasOne(x => x.Offer).WithMany().HasForeignKey(x => x.OfferId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Reservation).WithMany().HasForeignKey(x => x.ReservationId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Offer.Event.IsDeleted);
        });
    }
}
