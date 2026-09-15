using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public partial class AlifeDbContext
{
    public DbSet<EventModuleReport> EventModuleReports => Set<EventModuleReport>();
    public DbSet<EventModuleReportRevision> EventModuleReportRevisions => Set<EventModuleReportRevision>();
    public DbSet<EventModuleReportAction> EventModuleReportActions => Set<EventModuleReportAction>();

    private static void ConfigureEventCollaboration(ModelBuilder model)
    {
        model.Entity<EventTask>().Property(x => x.Stage).HasMaxLength(24).HasDefaultValue("preparation");
        model.Entity<EventTask>().HasOne<EventOccurrence>().WithMany().HasForeignKey(x => x.EventOccurrenceId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<EventRamRevision>().Property(x => x.EventPlanContextHash).HasMaxLength(128);
        model.Entity<EventModuleReport>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.EventId, x.ModuleCode }).IsUnique();
            b.Property(x => x.ModuleCode).HasMaxLength(80);
            b.Property(x => x.Status).HasMaxLength(24);
            b.Property(x => x.DraftEn).HasMaxLength(20000);
            b.Property(x => x.DraftZh).HasMaxLength(20000);
            b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(x => !x.Event.IsDeleted);
        });
        model.Entity<EventModuleReportRevision>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.ReportId, x.Version }).IsUnique();
            b.Property(x => x.TextEn).HasMaxLength(20000);
            b.Property(x => x.TextZh).HasMaxLength(20000);
            b.HasOne(x => x.Report).WithMany().HasForeignKey(x => x.ReportId).OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(x => !x.Report.Event.IsDeleted);
        });
        model.Entity<EventModuleReportAction>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Operation).HasMaxLength(24);
            b.Property(x => x.Reason).HasMaxLength(2000);
            b.HasIndex(x => new { x.ReportId, x.CreatedUtc });
            b.HasOne(x => x.Report).WithMany().HasForeignKey(x => x.ReportId).OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(x => !x.Report.Event.IsDeleted);
        });
    }
}
