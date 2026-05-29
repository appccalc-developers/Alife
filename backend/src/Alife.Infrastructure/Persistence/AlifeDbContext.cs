using Alife.Application.Common.Interfaces;
using Alife.Domain.Constants;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public class AlifeDbContext(DbContextOptions<AlifeDbContext> options) : DbContext(options), IAlifeDbContext
{
	public DbSet<Group> Groups => Set<Group>();
	public DbSet<Member> Members => Set<Member>();
	public DbSet<GroupMembership> GroupMemberships => Set<GroupMembership>();
	public DbSet<Page> Pages => Set<Page>();
	public DbSet<Section> Sections => Set<Section>();
	public DbSet<Link> Links => Set<Link>();
	public DbSet<Sermon> Sermons => Set<Sermon>();
	public DbSet<GroupEvent> GroupEvents => Set<GroupEvent>();
	public DbSet<EventEnrollment> EventEnrollments => Set<EventEnrollment>();
	public DbSet<EventReview> EventReviews => Set<EventReview>();

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		const string phoneUniqueFilter = "[phone_e164] IS NOT NULL AND [is_registered] = 1";
		var approvedMembershipFilter = $"[status] = {(int)MembershipStatus.Approved}";
		var leaderMembershipFilter = $"[status] = {(int)MembershipStatus.Approved} AND [role] = {(int)MembershipRole.Leader}";

		modelBuilder.Entity<Group>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameJson).IsRequired();
			cfg.HasOne(x => x.ParentGroup)
				.WithMany(x => x.Subgroups)
				.HasForeignKey(x => x.ParentGroupId)
				.OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ParentGroupId, x.UpdatedUtc });
		});

		modelBuilder.Entity<Member>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.DisplayName).HasMaxLength(150);
			cfg.Property(x => x.Email).HasMaxLength(200);
			cfg.Property(x => x.Language).HasMaxLength(2).IsRequired().HasDefaultValue(MemberLanguage.Zh);
			cfg.Property(x => x.PhoneE164).HasMaxLength(30);
			cfg.Property(x => x.LineUID).HasMaxLength(100);
			cfg.HasIndex(x => x.UpdatedUtc);
			cfg.HasIndex(x => x.PhoneE164)
				.IsUnique()
				.HasFilter(phoneUniqueFilter);
			cfg.HasIndex(x => x.LineUID)
				.IsUnique()
				.HasFilter("[line_uid] IS NOT NULL AND [is_registered] = 1");
		});

		modelBuilder.Entity<GroupMembership>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Group).WithMany(x => x.Memberships).HasForeignKey(x => x.GroupId);
			cfg.HasOne(x => x.Member).WithMany(x => x.Memberships).HasForeignKey(x => x.MemberId);

			cfg.HasIndex(x => new { x.GroupId, x.MemberId })
				.IsUnique()
				.HasFilter(approvedMembershipFilter);
			cfg.HasIndex(x => new { x.MemberId, x.UpdatedUtc });
			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });

			cfg.HasIndex(x => new { x.GroupId, x.Role })
				.IsUnique()
				.HasFilter(leaderMembershipFilter);
		});

		modelBuilder.Entity<Page>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleJson).IsRequired();
			cfg.Property(x => x.TitleDisplayStyle).HasMaxLength(50).IsRequired();

			cfg.HasOne(x => x.OwnerGroup)
				.WithMany()
				.HasForeignKey(x => x.OwnerGroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.Scope, x.OwnerGroupId, x.UpdatedUtc });
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<Section>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Page).WithMany(x => x.Sections).HasForeignKey(x => x.PageId);
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<Link>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.OwnerSection).WithMany(x => x.Links).HasForeignKey(x => x.OwnerSectionId);
			cfg.Property(x => x.Title).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.ImageUrl).HasMaxLength(500);
		});

		modelBuilder.Entity<Sermon>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.YoutubeVideoId).HasMaxLength(50).IsRequired();
			cfg.Property(x => x.Title).HasMaxLength(400).IsRequired();
			cfg.Property(x => x.SpeakerName).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.ThumbnailUrl).HasMaxLength(1000);
			cfg.Property(x => x.VideoUrl).HasMaxLength(1000);
			cfg.HasIndex(x => x.YoutubeVideoId).IsUnique();
			cfg.HasIndex(x => x.SortOrder);
			cfg.HasIndex(x => x.UpdatedUtc);
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<GroupEvent>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.TitleZh).HasMaxLength(300).IsRequired();

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
			cfg.HasIndex(x => x.CreatedByMemberId);
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<EventEnrollment>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.EnrollmentJson).IsRequired();

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Event)
				.WithMany()
				.HasForeignKey(x => x.EventId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Member)
				.WithMany()
				.HasForeignKey(x => x.MemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.EventId, x.MemberId }).IsUnique();
			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
		});

		modelBuilder.Entity<EventReview>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.ReviewJson).IsRequired();

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Event)
				.WithMany()
				.HasForeignKey(x => x.EventId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Member)
				.WithMany()
				.HasForeignKey(x => x.MemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.EventId, x.MemberId }).IsUnique();
			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
		});
	}
}
