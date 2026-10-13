using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public partial class AlifeDbContext
{
    public DbSet<EventActivityModuleConfiguration> EventActivityModuleConfigurations => Set<EventActivityModuleConfiguration>();

    private static void ConfigureActivityModuleConfigurations(ModelBuilder model)
    {
        model.Entity<EventActivityModuleConfiguration>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.ActivityId).HasMaxLength(80);
            b.Property(x => x.Kind).HasMaxLength(24);
            b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.HasIndex(x => new { x.EventId, x.ActivityId, x.OccurrenceId, x.Kind }).IsUnique();
            b.HasIndex(x => new { x.EventId, x.ActivityId, x.Kind })
                .IsUnique().HasDatabaseName("ix_event_activity_module_configurations_project_level")
                .HasFilter("[occurrence_id] IS NULL");
            b.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Occurrence).WithMany().HasForeignKey(x => x.OccurrenceId).OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(x => !x.Event.IsDeleted);
        });
    }
}
