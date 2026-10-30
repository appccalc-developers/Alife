using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public partial class AlifeDbContext
{
    public DbSet<EventActivityPlan> EventActivityPlans => Set<EventActivityPlan>();
    public DbSet<EventActivityProject> EventActivityProjects => Set<EventActivityProject>();
    public DbSet<EventActivityProjectAttribute> EventActivityProjectAttributes => Set<EventActivityProjectAttribute>();
    public DbSet<EventActivityProjectAnswer> EventActivityProjectAnswers => Set<EventActivityProjectAnswer>();
    public DbSet<EventActivityProjectDefaults> EventActivityProjectDefaults => Set<EventActivityProjectDefaults>();
    public DbSet<EventRamPolicyVersion> EventRamPolicyVersions => Set<EventRamPolicyVersion>();
    public DbSet<EventRamRevision> EventRamRevisions => Set<EventRamRevision>();
    public DbSet<EventRamAction> EventRamActions => Set<EventRamAction>();

    private static void ConfigureRamGovernance(ModelBuilder model)
    {
        model.Entity<EventTask>().Property(x => x.ActivityId).HasMaxLength(80);
        model.Entity<EventActivityPlan>(b =>
        {
            b.HasKey(x => x.EventId);
            b.ToTable(t => t.HasCheckConstraint("ck_event_activity_plans_questionnaire_version", "[questionnaire_version] = 2"));
            b.HasOne(x => x.Event).WithOne().HasForeignKey<EventActivityPlan>(x => x.EventId);
            b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.Property(x => x.WeatherConfirmationEn).HasMaxLength(4000);
            b.Property(x => x.WeatherConfirmationZh).HasMaxLength(4000);
        });
        model.Entity<EventActivityProject>(b =>
        {
            b.HasKey(x => new { x.EventId, x.ActivityId });
            b.Property(x => x.ActivityId).HasMaxLength(80);
            b.Property(x => x.NameEn).HasMaxLength(300);
            b.Property(x => x.NameZh).HasMaxLength(300);
            b.Property(x => x.ConditionsEn).HasMaxLength(4000);
            b.Property(x => x.ConditionsZh).HasMaxLength(4000);
            b.Property(x => x.SourcePresetKey).HasMaxLength(80);
            b.HasIndex(x => new { x.EventId, x.SortOrder });
            b.HasOne(x => x.Plan).WithMany(x => x.Projects).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne<EventOccurrence>().WithMany().HasForeignKey(x => x.OccurrenceId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<EventActivityProjectAttribute>(b =>
        {
            b.HasKey(x => new { x.EventId, x.ActivityId, x.AttributeCode });
            b.Property(x => x.ActivityId).HasMaxLength(80);
            b.Property(x => x.AttributeCode).HasMaxLength(16);
            b.ToTable(t => t.HasCheckConstraint("ck_event_activity_project_attributes_code",
                "[attribute_code] IN (N'hiking', N'water', N'sport', N'transport', N'camp', N'meal', N'outdoor')"));
            b.HasOne(x => x.Project).WithMany(x => x.Attributes)
                .HasForeignKey(x => new { x.EventId, x.ActivityId }).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<EventActivityProjectAnswer>(b =>
        {
            b.HasKey(x => new { x.EventId, x.ActivityId, x.QuestionCode });
            b.Property(x => x.ActivityId).HasMaxLength(80);
            b.Property(x => x.QuestionCode).HasMaxLength(80);
            b.Property(x => x.Value).HasMaxLength(8);
            b.Property(x => x.Source).HasMaxLength(8);
            b.ToTable(t =>
            {
                t.HasCheckConstraint("ck_event_activity_project_answers_value", "[value] IN (N'yes', N'no', N'unknown')");
                t.HasCheckConstraint("ck_event_activity_project_answers_source", "[source] IN (N'template', N'human')");
            });
            b.HasOne(x => x.Project).WithMany(x => x.Answers)
                .HasForeignKey(x => new { x.EventId, x.ActivityId }).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<EventActivityProjectDefaults>(b =>
        {
            b.HasKey(x => new { x.EventId, x.ActivityId });
            b.Property(x => x.ActivityId).HasMaxLength(80);
            b.Property(x => x.EligibilityEn).HasMaxLength(4000);
            b.Property(x => x.EligibilityZh).HasMaxLength(4000);
            b.Property(x => x.TermsEn).HasMaxLength(4000);
            b.Property(x => x.TermsZh).HasMaxLength(4000);
            b.Property(x => x.Currency).HasMaxLength(3);
            b.Property(x => x.FeeChargeScope).HasMaxLength(32);
            b.HasOne(x => x.Project).WithOne(x => x.Defaults)
                .HasForeignKey<EventActivityProjectDefaults>(x => new { x.EventId, x.ActivityId })
                .OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<EventTask>().HasOne<EventActivityProject>().WithMany()
            .HasForeignKey(x => new { x.EventId, x.ActivityId }).OnDelete(DeleteBehavior.Restrict);
        model.Entity<EventRamAssessment>(b =>
        {
            b.Property(x => x.SyncStatus).HasMaxLength(24).HasDefaultValue("Draft");
            b.Property(x => x.SyncError).HasMaxLength(64);
            b.Property(x => x.EvaluatedContextHash).HasMaxLength(64);
            b.Property(x => x.AiRiskDraftJson).HasDefaultValue("[]");
            b.HasIndex(x => new { x.IsUpdated, x.SyncDueUtc });
            b.Property(x => x.SchemaVersion).HasDefaultValue(2);
            b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.Property(x => x.Validity).HasMaxLength(32).HasDefaultValue("Draft");
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
