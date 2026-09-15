using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;
namespace Alife.Infrastructure.Persistence;
public partial class AlifeDbContext
{
    public DbSet<EventVenueWeeklyBooking> EventVenueWeeklyBookings => Set<EventVenueWeeklyBooking>();
    public DbSet<EventVenueBookingException> EventVenueBookingExceptions => Set<EventVenueBookingException>();
    public async Task LockEventVenueAsync(Guid venueId, CancellationToken ct = default)
    {
        if (!Database.IsSqlServer()) return;
        if (Database.CurrentTransaction is null) throw new InvalidOperationException("Venue locking requires a transaction.");
        var entity = Model.FindEntityType(typeof(EventVenue))!;
        static string Q(string s) => "[" + s.Replace("]", "]]", StringComparison.Ordinal) + "]";
        var sql = $"SELECT {Q(entity.FindProperty(nameof(EventVenue.Id))!.GetColumnName())} FROM {Q(entity.GetSchema() ?? "dbo")}.{Q(entity.GetTableName()!)} WITH (UPDLOCK,HOLDLOCK) WHERE {Q(entity.FindProperty(nameof(EventVenue.Id))!.GetColumnName())} = {{0}}";
        await Database.ExecuteSqlRawAsync(sql, new object[] { venueId }, ct);
    }
    private static void ConfigureVenueCalendar(ModelBuilder model)
    {
        model.Entity<EventVenue>().Property(x => x.TimeZone).HasMaxLength(120).HasDefaultValue("Pacific/Auckland");
        model.Entity<EventVenue>().Property(x => x.Kind).HasMaxLength(20).HasDefaultValue("venue");
        model.Entity<EventVenueWeeklyBooking>(b =>
        {
            b.HasKey(x => x.Id); b.HasIndex(x => new { x.VenueId, x.FirstDate }); b.Property(x => x.TimeZone).HasMaxLength(120); b.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
            b.Property(x => x.ChangeReason).HasMaxLength(2000);
            b.HasOne(x => x.Venue).WithMany().HasForeignKey(x => x.VenueId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.Event.IsDeleted);
        });
        model.Entity<EventVenueBookingException>(b =>
        {
            b.HasKey(x => x.Id); b.HasIndex(x => new { x.WeeklyBookingId, x.LocalDate, x.CreatedUtc }); b.Property(x => x.Reason).HasMaxLength(2000);
            b.HasOne(x => x.WeeklyBooking).WithMany(x => x.Exceptions).HasForeignKey(x => x.WeeklyBookingId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.WeeklyBooking.Event.IsDeleted);
        });
    }
}
