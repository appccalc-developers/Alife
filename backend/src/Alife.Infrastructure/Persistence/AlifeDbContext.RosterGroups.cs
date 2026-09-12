using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;
public partial class AlifeDbContext
{
    public DbSet<EventRosterGroup> EventRosterGroups => Set<EventRosterGroup>();
    private static void ConfigureRosterGroups(ModelBuilder model)
    {
        model.Entity<EventRosterGroup>(b =>
        {
            b.ToTable("event_roster_groups");
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.EventId, x.RoleCode }).IsUnique();
            b.Property(x => x.RoleCode).HasMaxLength(120);
            b.Property(x => x.ModuleCode).HasMaxLength(64);
            b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.HasOne<GroupEvent>().WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
